# macOS 시간표 위젯

macOS 14 이상, Intel/Apple Silicon 공용 무료 배포판입니다.

[설치 안내](./설치방법.txt). 배포본은 GitHub Releases에서 받습니다.
Apple 공증은 포함하지 않습니다. 다른 기기에서 위젯 등록은 검증 중입니다.

로그인한 계정에서 위젯 연결 코드를 발급하고 위젯 편집에 한 번 입력하면 해당 계정의 학년·반을 자동으로 사용합니다. 연결 전에는 반을 임의로 선택하지 않습니다. 코드는 시간표 조회 전용이며 DB에는 해시만 저장하고, 로그아웃·만료·연결 해제 시 폐기됩니다.

현재/다음 수업·교사·기본 시각을 표시합니다. 개인별 이동 교실과 단축수업 설정은 동기화하지 않습니다.

## 빌드

현재 프로젝트 형식은 Xcode 27.2에서 검증했습니다.
유료 Apple Developer Program 없이 무료 Apple Development 인증서로 빌드합니다. Xcode Personal Team을 먼저 설정하세요. Sparkle과 앱을 같은 인증서로 서명해 라이브러리 검증을 유지합니다.

```sh
bash macos/package.sh
```

배포 자료에 Gmarket Sans 폰트 라이선스 원문을 포함합니다.

## 자동 업데이트 배포

Sparkle 2.10.1 공식 아카이브를 고정 SHA-256으로 검증해 사용합니다. 자동 확인·다운로드를 기본 활성화하고 종료 시 설치합니다. 앱이 완전히 종료되어 있으면 다음 실행 때 확인합니다.

`bash macos/package.sh`는 설치 ZIP과 앱만 들어 있는 `BSSMTimetable-update.zip`을 만듭니다. GitHub Releases에 두 ZIP과 해시를 업로드한 뒤 다음 명령으로 앱캐스트를 서명합니다.

```sh
python3 macos/build-update-feed.py --archive macos/dist/BSSMTimetable-update.zip --tag RELEASE_TAG --version VERSION --build BUILD_NUMBER
```

서명된 `macos/updates/appcast.xml`을 커밋하면 기존 앱이 업데이트를 발견합니다. 앱·위젯 build 번호는 함께 증가시켜야 합니다. 피드를 수정하면 반드시 다시 서명해야 합니다.

개인 업데이트 키는 `.data/updates/ed25519.key`에 있으며 Git에서 제외합니다. 키를 잃으면 기존 설치판이 새 서명을 신뢰하지 않으므로 재생성하지 말고 비공개 백업을 복원하세요. 공개 키만 AppInfo.plist에 들어갑니다. 개인 키·개발 인증서를 저장소나 릴리스에 업로드하지 마세요.
