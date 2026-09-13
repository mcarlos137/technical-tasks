import 'package:flutter/material.dart';
import '../data/models.dart';
import '../theme/app_colors.dart';
import '../utils/date_format.dart';
import 'availability_chip.dart';
import 'organizer_chip.dart';

/// The game row shared by the Explore home and the Pick-up games list.
class GameRow extends StatelessWidget {
  const GameRow({
    super.key,
    required this.game,
    required this.onTap,
    this.showDivider = true,
  });

  final Game game;
  final VoidCallback onTap;

  /// Bottom separator (omitted after the last row of a day).
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) =>
          _build(context, constraints.maxWidth * 0.6),
    );
  }

  Widget _build(BuildContext context, double maxChipsWidth) {
    return Semantics(
      button: true,
      label:
          '${game.startTime} ${game.venue.name}, ${game.format}, '
          '${AvailabilityChip.labelFor(game.availability, game.spotsAvailable)}',
      child: InkWell(
        key: ValueKey('game-row-${game.id}'),
        onTap: onTap,
        child: Container(
          decoration: showDivider
              ? const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: AppColors.divider, width: 1),
                  ),
                )
              : null,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 38,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      displayTime(game.startTime),
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.visible,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: AppColors.border,
                ),
                const SizedBox(width: 8),
                Expanded(child: _VenueAndFormat(game: game)),
                const SizedBox(width: 6),
                Center(
                  child: ConstrainedBox(
                    // The chips keep their natural size but never take more than
                    // ~60% of the row, so the venue name always keeps some room.
                    constraints: BoxConstraints(maxWidth: maxChipsWidth),
                    child: OrganizerAvailabilityChip(
                      organizer: game.organizer,
                      trailing: AvailabilityChip(
                        availability: game.availability,
                        spotsAvailable: game.spotsAvailable,
                      ),
                    ),
                  ),
                ),
                // iOS-style thin chevron flush with the right edge, like the design.
                const SizedBox(
                  width: 20,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 17,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VenueAndFormat extends StatelessWidget {
  const _VenueAndFormat({required this.game});
  final Game game;

  @override
  Widget build(BuildContext context) {
    const meta = TextStyle(
      fontSize: 12,
      color: AppColors.textSecondary,
      height: 1.2,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          game.venue.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 17,
            color: AppColors.textPrimary,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 3),
        Text.rich(
          TextSpan(
            children: [
              const WidgetSpan(
                alignment: PlaceholderAlignment.middle,
                child: Padding(
                  padding: EdgeInsets.only(right: 4),
                  child: Icon(
                    Icons.supervised_user_circle_outlined,
                    size: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              TextSpan(text: game.format),
              if (game.isRecorded) ...const [
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Padding(
                    padding: EdgeInsets.only(left: 8, right: 3),
                    child: Icon(
                      Icons.videocam,
                      size: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                TextSpan(text: 'Recorded'),
              ],
            ],
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: meta,
        ),
      ],
    );
  }
}
