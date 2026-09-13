import 'package:flutter/material.dart';
import 'data/games_repository.dart';
import 'data/graphql_games_repository.dart';
import 'data/repository_scope.dart';
import 'screens/home_shell.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(BarcelonaApp(repository: GraphQLGamesRepository()));
}

class BarcelonaApp extends StatelessWidget {
  const BarcelonaApp({super.key, required this.repository});
  final GamesRepository repository;

  @override
  Widget build(BuildContext context) {
    return RepositoryScope(
      repository: repository,
      child: MaterialApp(
        title: 'CeleBreak Explore',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const HomeShell(),
      ),
    );
  }
}
