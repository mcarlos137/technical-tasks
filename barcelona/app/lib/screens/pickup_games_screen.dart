import 'package:flutter/material.dart';
import '../data/models.dart';
import '../data/repository_scope.dart';
import '../theme/app_colors.dart';
import '../widgets/async_state.dart';
import '../widgets/date_selector.dart';
import '../widgets/day_section.dart';
import '../widgets/filter_chips.dart';
import '../widgets/flex_pass_banner.dart';
import 'game_detail_screen.dart';

/// Screen 2: full pick-up games list grouped by day, with the date selector and "1+ spots" filter.
class PickupGamesScreen extends StatefulWidget {
  const PickupGamesScreen({super.key});

  /// The selector always shows at least this many days.
  static const minDays = 7;

  @override
  State<PickupGamesScreen> createState() => _PickupGamesScreenState();
}

class _PickupGamesScreenState extends State<PickupGamesScreen> {
  DateTime? _today;
  List<DateTime> _dates = const [];
  List<Game> _games = const [];
  DateTime? _selected;
  bool _onlyWithSpots = false;
  bool _loading = true;
  Object? _error;

  final _scroll = ScrollController();
  final _sectionKeys = <DateTime, GlobalKey>{};
  final _listKey = GlobalKey(debugLabel: 'games-list-viewport');
  bool _scrollingToDate = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_syncSelectedWithScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_today == null && _error == null && _loading) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = RepositoryScope.of(context);
      final today = _today ?? await repo.referenceDate();
      final games = await repo.games(
        from: today,
        minSpotsAvailable: _onlyWithSpots ? 1 : null,
      );
      if (!mounted) return;
      setState(() {
        _today = today;
        // Date range is fixed on first load so toggling the filter doesn't shift the selector.
        if (_dates.isEmpty) _dates = _buildDates(today, games);
        _selected ??= today;
        _games = games;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  static List<DateTime> _buildDates(DateTime today, List<Game> games) {
    final last = games.isEmpty
        ? today
        : games.map((g) => g.date).reduce((a, b) => a.isAfter(b) ? a : b);
    final count = last.difference(today).inDays + 1;
    final days = count < PickupGamesScreen.minDays
        ? PickupGamesScreen.minDays
        : count;
    return [
      for (var i = 0; i < days; i++)
        DateTime(today.year, today.month, today.day + i),
    ];
  }

  void _toggleSpots() {
    setState(() => _onlyWithSpots = !_onlyWithSpots);
    _load();
  }

  Future<void> _selectDate(DateTime date) async {
    setState(() => _selected = date);
    final ctx = _sectionKeys[date]?.currentContext;
    if (ctx == null) return;
    _scrollingToDate = true;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
    _scrollingToDate = false;
  }

  /// Highlights the day whose header is at the top of the list while the user scrolls.
  void _syncSelectedWithScroll() {
    if (_scrollingToDate || !_scroll.hasClients) return;
    final list = _listKey.currentContext?.findRenderObject();
    if (list is! RenderBox) return;
    DateTime? current;
    for (final date in _dates) {
      final box = _sectionKeys[date]?.currentContext?.findRenderObject();
      if (box is! RenderBox || !box.attached) continue;
      if (box.localToGlobal(Offset.zero, ancestor: list).dy <= 60) {
        current = date;
      }
    }
    if (_scroll.offset <= 0 && _dates.isNotEmpty) current = _dates.first;
    if (current != null && current != _selected) {
      setState(() => _selected = current);
    }
  }

  void _openGame(Game g) => Navigator.of(
    context,
  ).push(MaterialPageRoute(builder: (_) => GameDetailScreen(gameId: g.id)));

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TopBar(onBack: () => Navigator.of(context).maybePop()),
            const SizedBox(height: 12),
            FilterChipsRow(
              onlyWithSpots: _onlyWithSpots,
              onToggleSpots: _toggleSpots,
            ),
            const SizedBox(height: 16),
            if (_today != null && _selected != null)
              DateSelector(
                dates: _dates,
                today: _today!,
                selected: _selected!,
                onSelect: _selectDate,
              ),
            const SizedBox(height: 16),
            Expanded(
              child: KeyedSubtree(key: _listKey, child: _buildList()),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList() {
    if (_error != null) {
      return SingleChildScrollView(
        child: ErrorView(error: _error!, onRetry: _load),
      );
    }
    if (_today == null) return const LoadingView();
    final byDay = {for (final d in groupByDay(_games)) d.date: d.games};
    return Stack(
      children: [
        SingleChildScrollView(
          key: const ValueKey('games-list'),
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FlexPassBanner(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Flex Pass purchase is out of scope for this demo.',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 26),
              for (final date in _dates) ...[
                DaySection(
                  key: _sectionKeys.putIfAbsent(
                    date,
                    () => GlobalKey(debugLabel: 'day-$date'),
                  ),
                  date: date,
                  today: _today!,
                  games: byDay[date] ?? const [],
                  onGameTap: _openGame,
                  emptyMessage: _onlyWithSpots
                      ? 'No games with open spots on this day.'
                      : 'No pick-up games on this day.',
                ),
                const SizedBox(height: 40),
              ],
            ],
          ),
        ),
        if (_loading)
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LinearProgressIndicator(
              minHeight: 2,
              color: AppColors.accent,
            ),
          ),
      ],
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Text(
            'Pick-up games',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          Positioned(
            left: 4,
            child: IconButton(
              key: const ValueKey('back'),
              tooltip: 'Back',
              onPressed: onBack,
              icon: const Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 21,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
