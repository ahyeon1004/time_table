import SwiftUI
import WidgetKit
struct ContentView: View {
    @EnvironmentObject private var updates: AppUpdates
    @AppStorage("widgetReloadBuild") private var widgetReloadBuild = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("시간표", systemImage: "calendar").font(.largeTitle.bold())
            Text("바탕화면을 우클릭 → 위젯 편집 → 시간표를 추가하세요.")
            Text("학교 계정으로 로그인 → 알림 설정에서 위젯 연결 코드 만들기 → 위젯 편집에 코드를 붙여 넣으세요.").foregroundStyle(.secondary)
            Text("학교 기본 시간표를 표시합니다. 웹에서 설정한 이동 교실·단축수업은 아직 동기화되지 않습니다.").font(.caption).foregroundStyle(.secondary)
            Link(destination: URL(string: "https://bssm-timetable.vercel.app/#/dashboard")!) {
                Label("시간표 보러가기", systemImage: "calendar")
            }
            .buttonStyle(.borderedProminent)
            Link("학교 계정 로그인 · 위젯 연결", destination: URL(string: "https://bssm-timetable.vercel.app/#/notifications")!)
            Button("위젯 새로고침") {
                WidgetCenter.shared.reloadTimelines(ofKind: "imetableWidget")
            }
            Divider()
            Toggle("자동 업데이트", isOn: Binding(get: { updates.automatic }, set: { updates.automatic = $0 }))
            Text("새 버전을 자동으로 내려받고 앱을 종료할 때 설치해요. 앱을 완전히 종료했다면 다음 실행 때 확인해요.").font(.caption).foregroundStyle(.secondary)
            Button("지금 업데이트 확인", action: updates.check).disabled(!updates.canCheck)
        }
        .padding(30)
        .frame(width: 460)
        .task {
            guard let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String,
                  build != widgetReloadBuild else { return }
            WidgetCenter.shared.reloadTimelines(ofKind: "imetableWidget")
            widgetReloadBuild = build
        }
    }
}
