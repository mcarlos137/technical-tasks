import 'package:flutter/material.dart';
import '../data/models.dart';
import '../theme/app_colors.dart';
import '../utils/date_format.dart';
import 'game_row.dart';

/// Date header ("Tomorrow, Wed 26 August, 2026") followed by its game rows.
class DaySection extends StatelessWidget {
  const DaySection({
    super.key,
    required this.date,
    required this.today,
    required this.games,
    required this.onGameTap,
    this.emptyMessage = 'No pick-up games on this day.',
  });

  final DateTime date;
  final DateTime today;
  final List<Game> games;
  final ValueChanged<Game> onGameTap;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          dayHeader(date, today),
          style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 14),
        if (games.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              emptyMessage,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        for (var i = 0; i < games.length; i++)
          GameRow(
            game: games[i],
            showDivider: i < games.length - 1,
            onTap: () => onGameTap(games[i]),
          ),
      ],
    );
  }
}
