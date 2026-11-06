# macOS 시간표 위젯

macOS 14 이상, Intel/Apple Silicon 공용 무료 배포판입니다.

[설치 안내](./설치방법.txt). 배포본은 GitHub Releases에서 받습니다.
Apple 공증은 포함하지 않습니다. 다른 기기에서 위젯 등록은 검증 중입니다.

현재/다음 수업·교사·기본 시각을 표시합니다. 개인별 이동 교실과 단축수업 설정은 동기화하지 않습니다.

## 빌드

현재 프로젝트 형식은 Xcode 27.2에서 검증했습니다.
Apple Developer Program이나 인증서 없이 아래 스크립트로 ad-hoc 서명된 ZIP을 만듭니다.

```sh
bash macos/package.sh
```

배포 자료에 Gmarket Sans 폰트 라이선스 원문을 포함합니다.
