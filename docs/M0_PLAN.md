# M0 구현 계획

기준: 설계서 15장의 M0~M6 및 18.12절, 2026-11-02 M0 개발 요청.

- 기존 구조: React 19 / TypeScript 5.9 / Vite 7 / PixiJS 8. `SimulationAdapter`와 `SimulationClock`이 모델과 UI를 분리한다. 생성기는 128×128 지형, 기본 50개체, 공간 자원을 시드로 생성한다.
- 차이: `MockEngine`은 데모 번식이 기본 꺼짐이고 수명·성장·번식 대기시간·빈 공간 검증이 없다. 이벤트, 사망 아카이브, 개체수 기록이 무제한이며 누적 탄생 통계가 없다.
- 엔진: 별도 `SimulationEngine`을 추가하고 World, ResourceSystem, BehaviorSystem, EnergySystem, CreatureSystem, ReproductionSystem, SimulationConfig, SimulationEvents, SimulationStatistics로 책임을 분리한다. 기존 MockEngine은 과거 프로토타입 회귀 테스트용으로 보존한다.
- 규칙: 틱 단위의 기초/거리 비용, 유한 자원 섭취 및 지형별 재생, 연령에 따른 성장과 최대 수명, 에너지/성숙/쿨다운/공간 조건을 만족하는 무성생식. 자손은 변이 없이 기존 외형을 복사한다.
- 성능: 자원/개체 공간 해시, 제한된 이벤트·사망 아카이브·시계열, 독립 누적 카운터. UI 선택은 물리 난수에 영향을 주지 않는다.
- 연결: useSimulation의 어댑터 교체, 기존 Pixi 위치 보간·자원 표시·카메라 보존, 개체 생존/부모/탄생/성장/사망 원인, 실제 통계, 번식 및 자원 부족/회복 사건.
- 검증: 기존 회귀 테스트 + M0 모델/시계/React 통합 테스트, TypeScript, 전체 테스트, 빌드, 가능하면 실제 Chrome QA. 로컬 실행 오류 발생 시 요청에 따라 보고하고 중단한다.
- 제외: M1 변이/신체 진화, M2 신경망, M3 학습, M4 사회, M5 문명, M6 되감기/분기. 진행 상태 저장과 Worker 전환도 이번 범위에 추가하지 않는다.
