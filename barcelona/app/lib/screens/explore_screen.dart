import 'package:flutter/material.dart';
import '../data/models.dart';
import '../data/repository_scope.dart';
import '../theme/app_colors.dart';
import '../widgets/async_state.dart';
import '../widgets/day_section.dart';
import '../widgets/promo_carousel.dart';
import 'game_detail_screen.dart';
import 'pickup_games_screen.dart';

/// Screen 1: Explore home.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  /// Max rows in the home preview.
  static const previewCount = 4;

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _HomePreview {
  const _HomePreview(this.today, this.day);
  final DateTime today;
  final GameDay? day;
}

class _ExploreScreenState extends State<ExploreScreen> {
  Future<_HomePreview>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  /// The next day (from the reference "today") that still has joinable games.
  Future<_HomePreview> _load() async {
    final repo = RepositoryScope.of(context);
    final today = await repo.referenceDate();
    final games = await repo.games(from: today, minSpotsAvailable: 1);
    final days = groupByDay(games);
    return _HomePreview(today, days.isEmpty ? null : days.first);
  }

  void _openGame(Game g) => Navigator.of(
    context,
  ).push(MaterialPageRoute(builder: (_) => GameDetailScreen(gameId: g.id)));

  void _seeAll() => Navigator.of(
    context,
  ).push(MaterialPageRoute(builder: (_) => const PickupGamesScreen()));

  @override
  Widget build(BuildContext context) {
    const h = EdgeInsets.symmetric(horizontal: 16);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(top: 6, bottom: 24),
          children: [
            const Padding(
              padding: h,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    'Explore',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Barcelona',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 19),
            const PromoCarousel(),
            const SizedBox(height: 32),
            const Padding(
              padding: h,
              child: _SectionIntro(
                title: 'Pick-up games',
                description:
                    'Open friendly matches with teams being formed on the spot by a CeleBreak organizer.',
              ),
            ),
            const SizedBox(height: 22),
            Padding(
              padding: h,
              child: FutureBuilder<_HomePreview>(
                future: _future,
                builder: (context, snap) {
                  if (snap.hasError) {
                    return ErrorView(
                      error: snap.error!,
                      onRetry: () => setState(() => _future = _load()),
                    );
                  }
                  if (!snap.hasData) return const LoadingView();
                  final preview = snap.data!;
                  final day = preview.day;
                  if (day == null) {
                    return const Text(
                      'No upcoming games with open spots.',
                      style: TextStyle(color: AppColors.textSecondary),
                    );
                  }
                  return DaySection(
                    date: day.date,
                    today: preview.today,
                    games: day.games.take(ExploreScreen.previewCount).toList(),
                    onGameTap: _openGame,
                  );
                },
              ),
            ),
            const SizedBox(height: 22),
            Padding(
              padding: h,
              child: SizedBox(
                height: 37,
                child: TextButton(
                  key: const ValueKey('see-all'),
                  onPressed: _seeAll,
                  style: TextButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    foregroundColor: AppColors.textPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                  child: const Text('See all'),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Padding(
              padding: h,
              child: Divider(height: 1, thickness: 1, color: AppColors.divider),
            ),
            const SizedBox(height: 28),
            const Padding(
              padding: h,
              child: _SectionIntro(
                title: 'Tournaments',
                description:
                    'Competitive one-day events with prizes for winners.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionIntro extends StatelessWidget {
  const _SectionIntro({required this.title, required this.description});
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Text(
          description,
          style: const TextStyle(
            fontSize: 13.2,
            color: AppColors.textSecondary,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
