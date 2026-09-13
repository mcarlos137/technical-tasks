import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class Promo {
  const Promo({
    required this.eyebrow,
    required this.title,
    required this.cta,
    required this.colors,
    required this.icon,
  });
  final String eyebrow;
  final String title;
  final String cta;
  final List<Color> colors;
  final IconData icon;
}

const promos = [
  Promo(
    eyebrow: 'Starting at €34.99',
    title: 'Unlimited Football',
    cta: 'Achetez un pass flexible',
    colors: [Color(0xFF1F3A1A), Color(0xFF3F6B2A), Color(0xFF7FA35A)],
    icon: Icons.sports_soccer,
  ),
  Promo(
    eyebrow: 'Join the team',
    title: 'Internships',
    cta: 'Apply now. Limited spots available',
    colors: [Color(0xFF1B1F2A), Color(0xFF39404F), Color(0xFF6B7385)],
    icon: Icons.groups_2,
  ),
  Promo(
    eyebrow: 'New in Barcelona',
    title: 'Women\'s Games',
    cta: 'Find a game near you',
    colors: [Color(0xFF3A1A2E), Color(0xFF6B2A55), Color(0xFFA35A8C)],
    icon: Icons.emoji_events,
  ),
];

/// Horizontally scrolling promo cards: rounded image card + text overlay
/// (small heading, large bold title, yellow call-to-action).
class PromoCarousel extends StatelessWidget {
  const PromoCarousel({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 82,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: promos.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) => _PromoCard(promo: promos[i]),
      ),
    );
  }
}

class _PromoCard extends StatelessWidget {
  const _PromoCard({required this.promo});
  final Promo promo;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 237,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF3A3A3C)),
        gradient: LinearGradient(
          colors: promo.colors,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: Stack(
        children: [
          // Stand-in for the photo: a large glyph on the right, faded by a dark scrim.
          Positioned(
            right: -8,
            bottom: -14,
            child: Icon(
              promo.icon,
              size: 92,
              color: Colors.white.withValues(alpha: 0.55),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withValues(alpha: 0.55),
                    Colors.black.withValues(alpha: 0.05),
                  ],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            // scaleDown keeps the three lines inside the card at large text sizes.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: SizedBox(
                width: 211,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      promo.eyebrow,
                      style: const TextStyle(
                        fontSize: 11.2,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      promo.title,
                      maxLines: 1,
                      overflow: TextOverflow.clip,
                      softWrap: false,
                      style: const TextStyle(
                        fontSize: 18.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      promo.cta,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.clip,
                      style: const TextStyle(
                        fontSize: 11.2,
                        color: AppColors.accent,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
