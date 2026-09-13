import 'package:flutter/material.dart';
import '../data/models.dart';
import '../theme/app_colors.dart';

/// Small circular avatar. Uses the organizer's photo when the API provides one,
/// otherwise a yellow person glyph like the design.
class OrganizerAvatar extends StatelessWidget {
  const OrganizerAvatar({super.key, required this.organizer, this.size = 15});
  final Organizer organizer;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: AppColors.accent,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.bottomCenter,
      child: Icon(
        Icons.person,
        size: size * 0.85,
        color: const Color(0xFF2B2B2B),
      ),
    );
    final url = organizer.avatarUrl;
    if (url == null) return fallback;
    return ClipOval(
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}

/// Organizer pill (avatar + "Johnny C") with the availability chip tucked into its right end.
class OrganizerAvailabilityChip extends StatelessWidget {
  const OrganizerAvailabilityChip({
    super.key,
    required this.organizer,
    required this.trailing,
  });

  final Organizer organizer;
  final Widget trailing;

  static const _overlap = 10.0;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Flexible so a long name ellipsizes instead of overflowing on narrow screens.
        Flexible(
          child: Container(
            height: 21,
            padding: const EdgeInsets.only(left: 3, right: 6 + _overlap),
            decoration: BoxDecoration(
              color: AppColors.chip,
              borderRadius: BorderRadius.circular(10.5),
              border: Border.all(color: AppColors.border),
            ),
            child: Flex(
              direction: Axis.horizontal,
              mainAxisSize: MainAxisSize.min,
              // Under extreme squeeze (huge text scale) clip rather than overflow.
              clipBehavior: Clip.hardEdge,
              children: [
                OrganizerAvatar(organizer: organizer),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    organizer.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textPrimary,
                      height: 1.0,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        // Pull the availability chip over the organizer pill's right edge.
        Transform.translate(
          offset: const Offset(-_overlap, 0),
          child: trailing,
        ),
      ],
    );
  }
}
