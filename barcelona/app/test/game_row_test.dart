import 'package:barcelona_explore/theme/app_theme.dart';
import 'package:barcelona_explore/widgets/game_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';

Widget host(Widget child) => MaterialApp(
  theme: buildAppTheme(),
  home: Scaffold(body: SizedBox(width: 393, child: child)),
);

void main() {
  testWidgets('availability chip is color-coded by state', (tester) async {
    await tester.pumpWidget(
      host(
        Column(
          children: [
            GameRow(
              game: makeGame(
                id: 'u',
                date: '2026-08-26',
                time: '09:15',
                spots: 2,
              ),
              onTap: () {},
            ),
            GameRow(
              game: makeGame(
                id: 'a',
                date: '2026-08-26',
                time: '10:15',
                spots: 4,
              ),
              onTap: () {},
            ),
            GameRow(
              game: makeGame(
                id: 'f',
                date: '2026-08-26',
                time: '07:15',
                spots: 0,
              ),
              onTap: () {},
            ),
          ],
        ),
      ),
    );
    expect(find.text('Last 2 spots'), findsOneWidget);
    expect(find.text('4 spots'), findsOneWidget);
    expect(find.text('Full'), findsOneWidget);
    expect(find.byKey(const ValueKey('availability-urgent')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('availability-available')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('availability-full')), findsOneWidget);
    expect(find.text('9:15'), findsOneWidget);
    expect(find.text('Johnny C'), findsNWidgets(3));
  });

  testWidgets(
    'long venue names truncate with an ellipsis and the row is tappable',
    (tester) async {
      var taps = 0;
      final game = makeGame(
        id: 'x',
        date: '2026-08-26',
        time: '09:15',
        venue: 'Camp Municipal de Futbol Agapito Fernández',
        spots: 2,
      );
      await tester.pumpWidget(host(GameRow(game: game, onTap: () => taps++)));
      final text = tester.widget<Text>(find.text(game.venue.name));
      expect(text.overflow, TextOverflow.ellipsis);
      expect(text.maxLines, 1);
      expect(tester.takeException(), isNull); // no overflow errors
      await tester.tap(find.byKey(const ValueKey('game-row-x')));
      expect(taps, 1);
    },
  );

  testWidgets('recorded games show the Recorded tag', (tester) async {
    await tester.pumpWidget(
      host(
        GameRow(
          game: makeGame(
            id: 'r',
            date: '2026-08-26',
            time: '07:15',
            venue: 'La Catalana',
            spots: 0,
            recorded: true,
          ),
          onTap: () {},
        ),
      ),
    );
    expect(find.textContaining('Recorded', findRichText: true), findsOneWidget);
    expect(find.textContaining('8v8', findRichText: true), findsOneWidget);
  });
}
