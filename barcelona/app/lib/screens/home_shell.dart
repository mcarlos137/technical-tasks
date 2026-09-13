import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/app_bottom_nav.dart';
import 'explore_screen.dart';
import 'placeholder_tab.dart';

/// Tab scaffold. Each tab owns a nested Navigator so the bottom bar stays
/// visible on pushed screens (Pick-up games list, game detail).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  AppTab _current = AppTab.explore;
  final _navigatorKeys = {
    for (final t in AppTab.values) t: GlobalKey<NavigatorState>(),
  };

  Widget _rootFor(AppTab tab) => switch (tab) {
    AppTab.explore => const ExploreScreen(),
    AppTab.fields => const PlaceholderTab(
      title: 'Fields',
      icon: Icons.stadium_outlined,
    ),
    AppTab.messages => const PlaceholderTab(
      title: 'Messages',
      icon: Icons.chat_bubble_outline_rounded,
    ),
    AppTab.profile => const PlaceholderTab(
      title: 'Profile',
      icon: Icons.account_circle_outlined,
    ),
  };

  void _select(AppTab tab) {
    if (tab == _current) {
      _navigatorKeys[tab]!.currentState?.popUntil((r) => r.isFirst);
    } else {
      setState(() => _current = tab);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final nav = _navigatorKeys[_current]!.currentState!;
        if (nav.canPop()) {
          nav.pop();
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: IndexedStack(
          index: _current.index,
          children: [
            for (final tab in AppTab.values)
              Navigator(
                key: _navigatorKeys[tab],
                onGenerateRoute: (_) =>
                    MaterialPageRoute(builder: (_) => _rootFor(tab)),
              ),
          ],
        ),
        bottomNavigationBar: AppBottomNav(current: _current, onSelect: _select),
      ),
    );
  }
}
