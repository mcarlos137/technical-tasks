import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum AppTab { explore, fields, messages, profile }

/// Bottom navigation bar: Explore (active = yellow), Fields, Messages, Profile.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.current,
    required this.onSelect,
  });

  final AppTab current;
  final ValueChanged<AppTab> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(top: BorderSide(color: AppColors.divider, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              _item(
                AppTab.explore,
                'Explore',
                (c) => Icon(Icons.search_rounded, size: 27, color: c),
              ),
              _item(
                AppTab.fields,
                'Fields',
                (c) => CustomPaint(
                  size: const Size(28, 22),
                  painter: _PitchIconPainter(c),
                ),
              ),
              _item(
                AppTab.messages,
                'Messages',
                (c) =>
                    Icon(Icons.chat_bubble_outline_rounded, size: 25, color: c),
              ),
              _item(
                AppTab.profile,
                'Profile',
                (c) => Icon(Icons.account_circle_outlined, size: 26, color: c),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(AppTab tab, String label, Widget Function(Color) icon) {
    final active = tab == current;
    final color = active ? AppColors.accent : AppColors.textTertiary;
    return Expanded(
      child: InkResponse(
        key: ValueKey('tab-${tab.name}'),
        onTap: () => onSelect(tab),
        radius: 36,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(height: 27, child: Center(child: icon(color))),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Outline of a football pitch: frame, halfway line, centre circle and both boxes.
class _PitchIconPainter extends CustomPainter {
  _PitchIconPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;
    final r = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(2),
    );
    canvas.drawRRect(r.deflate(0.8), p);
    final cx = size.width / 2, cy = size.height / 2;
    canvas.drawLine(Offset(cx, 1), Offset(cx, size.height - 1), p);
    canvas.drawCircle(Offset(cx, cy), size.height * 0.2, p);
    final boxH = size.height * 0.5, boxW = size.width * 0.14;
    canvas.drawRect(Rect.fromLTWH(0.8, cy - boxH / 2, boxW, boxH), p);
    canvas.drawRect(
      Rect.fromLTWH(size.width - boxW - 0.8, cy - boxH / 2, boxW, boxH),
      p,
    );
  }

  @override
  bool shouldRepaint(_PitchIconPainter old) => old.color != color;
}
