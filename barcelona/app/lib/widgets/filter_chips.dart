import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// "Filters", "1+ spots", "Lowest price", "YEGO". Only "1+ spots" is functional.
class FilterChipsRow extends StatelessWidget {
  const FilterChipsRow({
    super.key,
    required this.onlyWithSpots,
    required this.onToggleSpots,
  });

  final bool onlyWithSpots;
  final VoidCallback onToggleSpots;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          const _Chip(icon: Icons.tune, label: 'Filters'),
          const SizedBox(width: 8),
          _Chip(
            key: const ValueKey('chip-1plus-spots'),
            label: '1+ spots',
            selected: onlyWithSpots,
            onTap: onToggleSpots,
          ),
          const SizedBox(width: 8),
          const _Chip(icon: Icons.attach_money, label: 'Lowest price'),
          const SizedBox(width: 8),
          const _Chip(icon: Icons.electric_moped, label: 'YEGO'),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    super.key,
    required this.label,
    this.icon,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppColors.background : AppColors.textPrimary;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.only(left: 11, right: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.textPrimary : AppColors.chip,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? AppColors.textPrimary : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 15, color: fg),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13.5,
                  color: fg,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
