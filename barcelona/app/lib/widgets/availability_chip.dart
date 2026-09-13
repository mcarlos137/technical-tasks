import 'package:flutter/material.dart';
import '../data/models.dart';
import '../theme/app_colors.dart';

/// Color-coded spots chip: urgent (amber filled), available (green outline), full (neutral gray).
class AvailabilityChip extends StatelessWidget {
  const AvailabilityChip({
    super.key,
    required this.availability,
    required this.spotsAvailable,
  });

  final Availability availability;
  final int spotsAvailable;

  static String labelFor(Availability availability, int spots) =>
      switch (availability) {
        Availability.full => 'Full',
        Availability.urgent => spots == 1 ? 'Last spot' : 'Last $spots spots',
        Availability.available => '$spots spots',
      };

  @override
  Widget build(BuildContext context) {
    final (fill, border, text) = switch (availability) {
      Availability.urgent => (
        AppColors.urgentFill,
        AppColors.urgentBorder,
        AppColors.urgentText,
      ),
      Availability.available => (
        AppColors.background,
        AppColors.available,
        AppColors.textPrimary,
      ),
      Availability.full => (
        AppColors.fullFill,
        AppColors.fullBorder,
        AppColors.fullText,
      ),
    };
    return Container(
      key: ValueKey('availability-${availability.name}'),
      height: 21,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(10.5),
        border: Border.all(color: border, width: 1),
      ),
      child: Text(
        labelFor(availability, spotsAvailable),
        style: TextStyle(
          color: text,
          fontSize: 12,
          height: 1.0,
          fontWeight: FontWeight.w400,
        ),
      ),
    );
  }
}
