import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../utils/date_format.dart';

/// Horizontally scrolling day tiles ("Today 25", "Wed 26", ...). The selected tile is lighter and bold.
class DateSelector extends StatefulWidget {
  const DateSelector({
    super.key,
    required this.dates,
    required this.today,
    required this.selected,
    required this.onSelect,
  });

  final List<DateTime> dates;
  final DateTime today;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;

  @override
  State<DateSelector> createState() => _DateSelectorState();
}

class _DateSelectorState extends State<DateSelector> {
  static const _tileWidth = 50.0;
  static const _gap = 8.0;
  final _controller = ScrollController();

  @override
  void didUpdateWidget(DateSelector old) {
    super.didUpdateWidget(old);
    if (old.selected != widget.selected) _revealSelected();
  }

  /// Keeps the selected tile on screen when selection changes from list scrolling.
  void _revealSelected() {
    if (!_controller.hasClients) return;
    final i = widget.dates.indexOf(widget.selected);
    if (i < 0) return;
    final left = 16 + i * (_tileWidth + _gap);
    final viewport = _controller.position.viewportDimension;
    final current = _controller.offset;
    double? target;
    if (left < current + 16) target = left - 16;
    if (left + _tileWidth > current + viewport - 16) {
      target = left + _tileWidth - viewport + 16;
    }
    if (target != null) {
      _controller.animateTo(
        target.clamp(0, _controller.position.maxScrollExtent),
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: ListView.separated(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: widget.dates.length,
        separatorBuilder: (_, _) => const SizedBox(width: _gap),
        itemBuilder: (context, i) {
          final date = widget.dates[i];
          final selected = date == widget.selected;
          return Semantics(
            button: true,
            selected: selected,
            child: GestureDetector(
              key: ValueKey(
                'date-tile-${date.toIso8601String().substring(0, 10)}',
              ),
              onTap: () => widget.onSelect(date),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: _tileWidth,
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.dateTileSelected
                      : AppColors.dateTile,
                  borderRadius: BorderRadius.circular(9),
                ),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        dateTileLabel(date, widget.today),
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppColors.textPrimary,
                          fontWeight: selected
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '${date.day}',
                        style: TextStyle(
                          fontSize: 20,
                          height: 1.1,
                          color: AppColors.textPrimary,
                          fontWeight: selected
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
