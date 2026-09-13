import 'package:barcelona_explore/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';

void main() {
  Future<void> pumpApp(WidgetTester tester, FakeGamesRepository repo) async {
    tester.view.physicalSize = const Size(393 * 3, 852 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(BarcelonaApp(repository: repo));
    await tester.pumpAndSettle();
  }

  testWidgets('Explore home shows the next day with open spots, max 4 rows', (
    tester,
  ) async {
    await pumpApp(tester, FakeGamesRepository(sampleGames));
    expect(find.text('Explore'), findsWidgets);
    expect(find.text('Barcelona'), findsOneWidget);
    // Today's games are all full, so the preview is tomorrow's joinable games.
    expect(find.text('Tomorrow, Wed 26 August, 2026'), findsOneWidget);
    expect(find.text('Last 2 spots'), findsOneWidget);
    expect(find.text('4 spots'), findsOneWidget);
    expect(find.text('3 spots'), findsOneWidget);
    expect(find.text('5 spots'), findsOneWidget);
    expect(find.text('6 spots'), findsNothing); // 5th joinable game is cut
    expect(
      find.text('La Catalana'),
      findsNothing,
    ); // full games are not previewed
    await tester.scrollUntilVisible(
      find.text('Tournaments'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Tournaments'), findsOneWidget);
  });

  testWidgets(
    'See all opens the list; "1+ spots" hides full games; bottom bar stays',
    (tester) async {
      await pumpApp(tester, FakeGamesRepository(sampleGames));
      await tester.ensureVisible(find.byKey(const ValueKey('see-all')));
      await tester.tap(find.byKey(const ValueKey('see-all')));
      await tester.pumpAndSettle();

      expect(find.text('Pick-up games'), findsOneWidget);
      expect(find.text('Today, Tue 25 August, 2026'), findsOneWidget);
      expect(find.text('Full'), findsWidgets);
      expect(find.byKey(const ValueKey('tab-explore')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('chip-1plus-spots')));
      await tester.pumpAndSettle();
      expect(find.text('Full'), findsNothing);
      expect(find.text('No games with open spots on this day.'), findsWidgets);

      await tester.tap(find.byKey(const ValueKey('chip-1plus-spots')));
      await tester.pumpAndSettle();
      expect(find.text('Full'), findsWidgets);
    },
  );

  testWidgets('selecting a date scrolls its section into view and selects it', (
    tester,
  ) async {
    await pumpApp(tester, FakeGamesRepository(sampleGames));
    await tester.ensureVisible(find.byKey(const ValueKey('see-all')));
    await tester.tap(find.byKey(const ValueKey('see-all')));
    await tester.pumpAndSettle();

    final header = find.text('Thu 27 August, 2026');
    final before = tester.getTopLeft(header).dy;
    await tester.tap(find.byKey(const ValueKey('date-tile-2026-08-27')));
    await tester.pumpAndSettle();
    final after = tester.getTopLeft(header).dy;
    expect(after, lessThan(before));
    final tile = tester.widget<Semantics>(
      find
          .ancestor(
            of: find.byKey(const ValueKey('date-tile-2026-08-27')),
            matching: find.byType(Semantics),
          )
          .first,
    );
    expect(tile.properties.selected, isTrue);
  });

  testWidgets('tapping a row opens the detail placeholder', (tester) async {
    await pumpApp(tester, FakeGamesRepository(sampleGames));
    await tester.tap(find.byKey(const ValueKey('game-row-b1')));
    await tester.pumpAndSettle();
    expect(find.text('Game details'), findsOneWidget);
    expect(find.text('Agapito Fernández'), findsOneWidget);
  });
}
