const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { Reader } = require('@maxmind/geoip2-node');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logbox';
const ENABLE_DEMO = process.env.ENABLE_DEMO_MODE === 'true';

// [FIX-06] Helmet 보안 헤더 적용
app.use(helmet({
  contentSecurityPolicy: false, // SPA 프론트엔드 CSP로 대체
  crossOriginEmbedderPolicy: false,
}));

// [FIX-05] CORS 화이트리스트 적용
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// [FIX-09] Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api/', generalLimiter);

const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { message: 'Sync rate limit exceeded.' },
});

const geoipLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { message: 'GeoIP lookup rate limit exceeded.' },
});

// MongoDB 연결
mongoose.connect(MONGODB_URI)
  .then(() => console.log('[LogBox Server] MongoDB connected.'))
  .catch(err => console.error('[LogBox Server] MongoDB connection error:', err));

// MaxMind GeoIP2 Reader 초기화
let geoipReader;
Reader.open(path.join(__dirname, 'GeoLite2-City.mmdb'))
  .then(reader => {
    geoipReader = reader;
    console.log('[LogBox Server] GeoIP2 Reader opened successfully.');
  })
  .catch(err => {
    console.error('[LogBox Server] Failed to open GeoIP2 Reader:', err);
  });

// Mongoose 스키마 및 모델 정의
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  picture: String,
  geocodingApiKey: String,
  trustedDeviceNames: [String],
});
const User = mongoose.model('User', UserSchema);

const RecordSchema = new Schema({
  id: { type: String, required: true },
  platform: String,
  ip: String,
  latitude: Number,
  longitude: Number,
  device: {
    id: String,
    name: String,
    model: String,
    os: String,
    browser: String,
    trusted: Boolean,
    lastActive: String,
    lastSeen: String,
    ip: String,
    location: String,
  },
  timeISO: String,
  threatLevel: Number,
  raw: String,
  body: String,
  from: String,
  subject: String,
  domain: String,
  snippet: String,
  isServerVerified: Boolean,
  authMode: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});
RecordSchema.index({ userId: 1, id: 1 }, { unique: true });
const Record = mongoose.model('Record', RecordSchema);

const DeviceSchema = new Schema({
  id: { type: String, required: true },
  name: String,
  model: String,
  os: String,
  browser: String,
  trusted: Boolean,
  lastActive: String,
  lastSeen: String,
  ip: String,
  location: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});
DeviceSchema.index({ userId: 1, id: 1 }, { unique: true });
const Device = mongoose.model('Device', DeviceSchema);

const BaseSchema = new Schema({
  id: { type: String, required: true },
  name: String,
  center: {
    lat: Number,
    lng: Number,
  },
  radiusKm: Number,
  muted: Boolean,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});
BaseSchema.index({ userId: 1, id: 1 }, { unique: true });
const Base = mongoose.model('Base', BaseSchema);

const SecurityLogSchema = new Schema({
  id: { type: String, required: true },
  timestamp: String,
  level: String,
  message: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});
SecurityLogSchema.index({ userId: 1, id: 1 }, { unique: true });
const SecurityLog = mongoose.model('SecurityLog', SecurityLogSchema);

// [FIX-04] 입력값 검증 유틸리티
const MAX_SYNC_RECORDS = 100;
const MAX_SYNC_DEVICES = 50;

const ALLOWED_RECORD_FIELDS = [
  'id', 'platform', 'ip', 'latitude', 'longitude', 'device',
  'timeISO', 'threatLevel', 'raw', 'body', 'from', 'subject',
  'domain', 'snippet', 'isServerVerified', 'authMode'
];

const ALLOWED_DEVICE_FIELDS = [
  'id', 'name', 'model', 'os', 'browser', 'trusted',
  'lastActive', 'lastSeen', 'ip', 'location'
];

function sanitizeObject(obj, allowedFields) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const clean = {};
  for (const key of allowedFields) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        const hasOperator = Object.keys(obj[key]).some(k => k.startsWith('$'));
        if (hasOperator) continue;
      }
      clean[key] = obj[key];
    }
  }
  return clean;
}

// [FIX-08] ID 파라미터 타입 검증 미들웨어
const validateIdParam = (req, res, next) => {
  const id = req.params.id || req.body?.id;
  if (id !== undefined) {
    if (typeof id !== 'string') {
      return res.status(400).json({ message: 'id must be a string' });
    }
    if (id.length === 0 || id.length > 256) {
      return res.status(400).json({ message: 'id length must be 1-256 characters' });
    }
    if (id.startsWith('$')) {
      return res.status(400).json({ message: 'Invalid id format' });
    }
  }
  next();
};

// 인증 미들웨어
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  // [FIX-01] 데모 토큰 환경 변수 제어
  if (token === 'demo-token') {
    if (!ENABLE_DEMO) {
      return res.status(403).json({ message: 'Demo mode is disabled' });
    }
    try {
      let user = await User.findOne({ email: 'demo@logbox.io' });
      if (!user) {
        user = new User({
          email: 'demo@logbox.io',
          name: 'Demo User',
          picture: '',
          trustedDeviceNames: ['YouTube/Desktop', 'Kakao/Web'],
        });
        await user.save();
      }
      req.user = user;
      return next();
    } catch (err) {
      console.error('Demo user resolution error:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // Google Access Token 검증
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const { email, name, picture } = response.data;
    if (!email) {
      return res.status(401).json({ message: 'Invalid token (no email in profile)' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, picture, trustedDeviceNames: [] });
      await user.save();
    } else {
      user.name = name;
      user.picture = picture;
      await user.save();
    }
    req.user = user;
    return next();
  } catch (err) {
    console.error('Google token verification failed:', err.message);
    return res.status(401).json({ message: 'Unauthorized (token invalid or expired)' });
  }
};

// 엔드포인트 구현
// 1. 유저 정보 조회 및 Hydration
app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const records = await Record.find({ userId });
    const devices = await Device.find({ userId });
    let bases = await Base.find({ userId });
    const securityLogs = await SecurityLog.find({ userId });

    // 데모 유저 또는 완전 신규 유저 초기 데이터 주입
    if (records.length === 0 && bases.length === 0) {
      // 기본 거점 등록
      const defaultBase = new Base({
        id: 'base-1',
        name: '집',
        center: { lat: 37.5665, lng: 126.9780 },
        radiusKm: 5,
        muted: false,
        userId,
      });
      await defaultBase.save();
      bases = [defaultBase];
    }

    res.json({
      userProfile: {
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
      },
      geocodingApiKey: req.user.geocodingApiKey || null,
      trustedDeviceNames: req.user.trustedDeviceNames || [],
      records,
      devices,
      bases,
      securityLogs,
    });
  } catch (err) {
    console.error('Fetch user data failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 2. Gmail 동기화 결과 저장 (수집 결과 병합 - bulkWrite 일괄 적용)
// [FIX-04] 입력값 검증 + 크기 제한 + 필드 화이트리스트 적용
app.post('/api/user/sync', syncLimiter, authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { records = [], devices = [] } = req.body;

    // 입력값 검증
    if (!Array.isArray(records) || !Array.isArray(devices)) {
      return res.status(400).json({ message: 'records and devices must be arrays' });
    }
    if (records.length > MAX_SYNC_RECORDS) {
      return res.status(400).json({ message: `Max ${MAX_SYNC_RECORDS} records per sync` });
    }
    if (devices.length > MAX_SYNC_DEVICES) {
      return res.status(400).json({ message: `Max ${MAX_SYNC_DEVICES} devices per sync` });
    }

    // 레코드 일괄 bulkWrite (필드 화이트리스트 적용)
    const recordBulkOps = records
      .filter(r => r && typeof r.id === 'string')
      .map(r => {
        const sanitized = sanitizeObject(r, ALLOWED_RECORD_FIELDS);
        if (sanitized.device && typeof sanitized.device === 'object') {
          sanitized.device = sanitizeObject(sanitized.device, ALLOWED_DEVICE_FIELDS);
        }
        return {
          updateOne: {
            filter: { userId, id: String(sanitized.id) },
            update: { $set: { ...sanitized, userId } },
            upsert: true
          }
        };
      });

    if (recordBulkOps.length > 0) {
      await Record.bulkWrite(recordBulkOps, { ordered: false });
    }

    // 신뢰 기기 일괄 bulkWrite (필드 화이트리스트 적용)
    const deviceBulkOps = devices
      .filter(d => d && typeof d.id === 'string')
      .map(d => {
        const sanitized = sanitizeObject(d, ALLOWED_DEVICE_FIELDS);
        return {
          updateOne: {
            filter: { userId, id: String(sanitized.id) },
            update: { $setOnInsert: { ...sanitized, userId } },
            upsert: true
          }
        };
      });

    if (deviceBulkOps.length > 0) {
      await Device.bulkWrite(deviceBulkOps, { ordered: false });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Sync user data failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 3. 지오코딩 API 키 설정
app.put('/api/user/geocoding-key', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { geocodingApiKey } = req.body;
    await User.findByIdAndUpdate(userId, { geocodingApiKey });
    res.json({ success: true });
  } catch (err) {
    console.error('Set geocoding key failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 4. 레코드 삭제 (위협 차단)
app.delete('/api/records/:id', authMiddleware, validateIdParam, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    await Record.deleteOne({ userId, id });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete record failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 5. 신뢰 기기 추가
app.post('/api/devices', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const device = req.body;
    await Device.updateOne(
      { userId, id: device.id },
      { $set: { ...device, userId } },
      { upsert: true }
    );
    res.json({ success: true, device });
  } catch (err) {
    console.error('Add device failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 6. 신뢰 기기 삭제
app.delete('/api/devices/:id', authMiddleware, validateIdParam, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    await Device.deleteOne({ userId, id });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete device failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 7. 거점 추가
app.post('/api/bases', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const base = req.body;
    await Base.updateOne(
      { userId, id: base.id },
      { $set: { ...base, userId } },
      { upsert: true }
    );
    res.json({ success: true, base });
  } catch (err) {
    console.error('Add base failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 8. 거점 삭제
app.delete('/api/bases/:id', authMiddleware, validateIdParam, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    await Base.deleteOne({ userId, id });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete base failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 9. 거점 음소거 상태 토글
app.put('/api/bases/:id/mute', authMiddleware, validateIdParam, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { muted } = req.body;
    if (typeof muted !== 'boolean') {
      return res.status(400).json({ message: 'muted must be a boolean' });
    }
    await Base.updateOne({ userId, id }, { $set: { muted } });
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle base mute failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 10. 보안 로그 추가
app.post('/api/security-logs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const log = req.body;
    await SecurityLog.updateOne(
      { userId, id: log.id },
      { $set: { ...log, userId } },
      { upsert: true }
    );
    res.json({ success: true, log });
  } catch (err) {
    console.error('Add security log failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 11. 보안 로그 모두 비우기
app.delete('/api/security-logs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    await SecurityLog.deleteMany({ userId });
    res.json({ success: true });
  } catch (err) {
    console.error('Clear security logs failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 12. 신뢰 기기 이름 저장 (isDeviceTrusted 지원용)
app.post('/api/user/trusted-device-names', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name } = req.body;
    await User.findByIdAndUpdate(userId, { $addToSet: { trustedDeviceNames: name } });
    res.json({ success: true });
  } catch (err) {
    console.error('Add trusted device name failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 13. [신설] MongoDB Aggregation Pipeline 기반 실시간 달력 통계 연동
app.get('/api/stats/calendar', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const stats = await Record.aggregate([
      {
        $match: {
          userId: userId,
          timeISO: {
            $exists: true,
            $ne: null,
            $gte: startOfMonth.toISOString(),
            $lte: endOfMonth.toISOString(),
          }
        }
      },
      {
        $project: {
          day: { $dayOfMonth: { $toDate: "$timeISO" } },
          threatLevel: "$threatLevel"
        }
      },
      {
        $group: {
          _id: "$day",
          count: { $sum: 1 },
          maxThreatLevel: { $max: "$threatLevel" }
        }
      }
    ]);

    const dailyStatus = Array.from({ length: 30 }, () => 'safe');
    
    stats.forEach(item => {
      const dayIndex = item._id - 1;
      if (dayIndex >= 0 && dayIndex < 30) {
        if (item.maxThreatLevel === 3) {
          dailyStatus[dayIndex] = 'danger';
        } else if (item.maxThreatLevel === 1 || item.maxThreatLevel === 2) {
          dailyStatus[dayIndex] = 'caution';
        } else {
          dailyStatus[dayIndex] = 'safe';
        }
      }
    });

    res.json({ dailyStatus });
  } catch (err) {
    console.error('Fetch calendar stats failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 14. [신설] 기기 즉시 차단 및 격리 수행 endpoint
app.post('/api/security/block-endpoint', authMiddleware, validateIdParam, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Valid string id is required' });
    }

    await Device.deleteOne({ userId, id });
    await Record.deleteOne({ userId, id });

    const logId = `log-block-${Date.now()}`;
    const newLog = new SecurityLog({
      id: logId,
      timestamp: new Date().toISOString(),
      level: 'CRITICAL',
      message: `접근 차단 및 격리 수행 (대상 ID: ${id})`,
      userId,
    });
    await newLog.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Block endpoint failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 15. [신설] 비밀번호 재설정 endpoint
app.post('/api/security/reset-password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { deviceId } = req.body;

    const logId = `log-reset-${Date.now()}`;
    const newLog = new SecurityLog({
      id: logId,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `비밀번호 재설정 완료 (장치 ID: ${deviceId || '알 수 없음'})`,
      userId,
    });
    await newLog.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password failed:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// [FIX-02] GeoIP Lookup Endpoint - 인증 + IP 형식 검증 + Rate Limiting 적용
app.get('/api/geoip/:ip', geoipLimiter, authMiddleware, async (req, res) => {
  try {
    const { ip } = req.params;

    // IP 형식 검증
    const ipRegex = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }

    if (!geoipReader) {
      return res.status(500).json({ message: 'GeoIP reader not initialized' });
    }
    const response = geoipReader.city(ip);
    
    const cityName = (response.city && response.city.names) 
      ? (response.city.names.ko || response.city.names.en || '알 수 없음') 
      : '알 수 없음';
      
    const regionName = (response.subdivisions && response.subdivisions[0] && response.subdivisions[0].names)
      ? (response.subdivisions[0].names.ko || response.subdivisions[0].names.en || '')
      : '';
      
    const country = (response.country && response.country.names)
      ? (response.country.names.ko || response.country.names.en || '')
      : '';

    const location = response.location || {};

    res.json({
      city: cityName,
      regionName: regionName,
      country: country,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  } catch (err) {
    console.error('GeoIP lookup failed:', err.message);
    res.json({ city: '알 수 없음' });
  }
});

// [FIX-12] 전역 에러 핸들러 — 내부 정보 노출 방지
app.use((err, req, res, _next) => {
  console.error('[LogBox Server Error]', err);
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.status(err.status || 500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`[LogBox Server] Server is running on port ${PORT}`);
});
