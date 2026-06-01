# LogBox Agent Instructions

## Project
Google 보안 메일 기반 이상 로그인 탐지 보안 웹앱

## Path
c:\Users\U209-40\Desktop\20260891\logbox\

## Tech Stack
- Vite + React + TypeScript (strict)
- Tailwind CSS v3 다크 테마 고정
- React Router DOM
- react-leaflet (지도)
- crypto-js (PBKDF2 암호화)
- @react-oauth/google (OAuth 2.0)
- Gmail API / Google Geocoding API
- Web Notification API

## Key Rules
- TypeScript strict 모드 any 타입 금지
- 모든 데이터 cryptoService 경유 암호화 저장
- LocalStorage 평문 저장 절대 금지
- 모바일 390px 기준 레이아웃
- 다크 테마 고정 (라이트 모드 없음)

## Services
- gmailService.ts: Gmail API 호출 + 보안 메일 파싱
- geocodingService.ts: 위치 텍스트 → 좌표 변환
- cryptoService.ts: PBKDF2 암호화/복호화

## Core Logic
- Haversine 공식으로 거리 계산
- 800km/h 초과 → 워프 위협
- 위협 감지 시 Web Notification API 알림

## Screens
1. LoginPage - Google OAuth 로그인
2. DashboardPage - 속도계 + 로그 목록
3. WarpAnalysisPage - 지도 + 액션
4. BaseManagePage - 거점/기기 관리
5. SettingsPage - 캘린더 + 설정

## Error Handling
- 토큰 만료 → Refresh Token 자동 갱신
- 네트워크 없음 → 캐시 데이터 유지
- 파싱 실패 → 해당 메일 스킵
- 권한 거부 → LoginPage 복귀