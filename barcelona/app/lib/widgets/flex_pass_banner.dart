import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// "Enjoy more games for less!" Flex Pass promo: badge, two-line text, arrow.
class FlexPassBanner extends StatelessWidget {
  const FlexPassBanner({super.key, this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.flexBackground,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(15, 15, 18, 15),
          child: Row(
            children: [
              const _FlexBadge(),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Enjoy more games for less!',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Purchase a Flex Pass',
                      style: TextStyle(fontSize: 13, color: Color(0xFFA7A5BA)),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.arrow_forward,
                size: 20,
                color: AppColors.textPrimary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FlexBadge extends StatelessWidget {
  const _FlexBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 66,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(3),
        gradient: const LinearGradient(
          colors: [AppColors.flexBadgeStart, AppColors.flexBadgeEnd],
        ),
      ),
      child: const Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: 'FLEX ',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 10.5,
                letterSpacing: 0.3,
              ),
            ),
            TextSpan(
              text: 'pass',
              style: TextStyle(fontStyle: FontStyle.italic, fontSize: 10),
            ),
          ],
        ),
        style: TextStyle(color: Colors.white),
      ),
    );
  }
}
