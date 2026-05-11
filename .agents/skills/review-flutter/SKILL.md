---
name: review-flutter
description: Flutter Dart 파일을 리뷰합니다. 성능, 상태관리, 코드 품질을 체크합니다.
argument-hint: [파일경로]
allowed-tools: Read Glob Grep
---

Flutter Dart 파일을 리뷰합니다: $ARGUMENTS

다음 항목을 체크하세요:

1. **상태관리**: Provider/Riverpod 사용이 올바른지, 불필요한 rebuild가 없는지
2. **성능**: const 위젯 활용, 불필요한 재빌드 여부
3. **에러 처리**: async/await의 예외처리가 적절한지
4. **코드 품질**: 중복 코드, 너무 긴 build() 메서드
5. **Flutter 관례**: 네이밍, 파일 구조가 Flutter 컨벤션을 따르는지

각 항목에 대해 문제점과 개선 방안을 구체적으로 제시하세요.
