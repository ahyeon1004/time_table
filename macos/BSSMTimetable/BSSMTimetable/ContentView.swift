import SwiftUI
struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("시간표", systemImage: "calendar").font(.largeTitle.bold())
            Text("바탕화면을 우클릭 → 위젯 편집 → 시간표를 추가하세요.")
            Text("위젯을 우클릭 → 위젯 편집에서 학년과 반을 선택할 수 있어요.").foregroundStyle(.secondary)
            Text("학교 기본 시간표를 표시합니다. 웹에서 설정한 이동 교실·단축수업은 아직 동기화되지 않습니다.").font(.caption).foregroundStyle(.secondary)
            Link("시간표 웹 열기", destination: URL(string: "https://bssm-timetable.vercel.app")!)
        }.padding(30).frame(width: 460)
    }
}
