import 'package:flutter/material.dart';
import '../data/models.dart';
import '../data/repository_scope.dart';
import '../theme/app_colors.dart';
import '../utils/date_format.dart';
import '../widgets/async_state.dart';
import '../widgets/availability_chip.dart';
import '../widgets/organizer_chip.dart';

/// Placeholder game detail, loaded through the API's single-game query.
class GameDetailScreen extends StatefulWidget {
  const GameDetailScreen({super.key, required this.gameId});
  final String gameId;

  @override
  State<GameDetailScreen> createState() => _GameDetailScreenState();
}

class _GameDetailScreenState extends State<GameDetailScreen> {
  Future<(Game?, DateTime)>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  Future<(Game?, DateTime)> _load() async {
    final repo = RepositoryScope.of(context);
    return (await repo.game(widget.gameId), await repo.referenceDate());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 21),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'Game details',
          style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: FutureBuilder<(Game?, DateTime)>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return ErrorView(
              error: snap.error!,
              onRetry: () => setState(() => _future = _load()),
            );
          }
          if (!snap.hasData) return const LoadingView();
          final (game, today) = snap.data!;
          if (game == null) {
            return const Center(
              child: Text(
                'This game no longer exists.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                game.venue.name,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (game.venue.address != null) ...[
                const SizedBox(height: 4),
                Text(
                  game.venue.address!,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 20),
              _Info(icon: Icons.event, label: dayHeader(game.date, today)),
              _Info(
                icon: Icons.schedule,
                label:
                    '${displayTime(game.startTime)} – ${displayTime(game.endTime)} (${game.durationMinutes} min)',
              ),
              _Info(
                icon: Icons.supervised_user_circle_outlined,
                label: game.format,
              ),
              if (game.isRecorded)
                const _Info(icon: Icons.videocam, label: 'Recorded'),
              _Info(
                icon: Icons.euro,
                label: '${formatPrice(game.priceEur)} per player',
              ),
              _Info(
                icon: Icons.groups_outlined,
                label:
                    '${game.spotsTotal - game.spotsAvailable} of ${game.spotsTotal} spots taken',
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  OrganizerAvailabilityChip(
                    organizer: game.organizer,
                    trailing: AvailabilityChip(
                      availability: game.availability,
                      spotsAvailable: game.spotsAvailable,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              FilledButton(
                onPressed: null,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(46),
                ),
                child: Text(
                  game.availability == Availability.full
                      ? 'Game full'
                      : 'Booking coming soon',
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 15))),
      ],
    ),
  );
}
