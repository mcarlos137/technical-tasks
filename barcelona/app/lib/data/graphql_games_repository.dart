import 'package:flutter/foundation.dart';
import 'package:graphql/client.dart';

import 'games_repository.dart';
import 'models.dart';

/// Resolves the API URL: `--dart-define=GAMES_API_URL=...` wins; otherwise
/// localhost (iOS simulator, web, desktop) or 10.0.2.2 (Android emulator).
String defaultGamesApiUrl() {
  const fromEnv = String.fromEnvironment('GAMES_API_URL');
  if (fromEnv.isNotEmpty) return fromEnv;
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:4000/graphql';
  }
  return 'http://localhost:4000/graphql';
}

const _gameFields = r'''
  id date startTime endTime durationMinutes format
  spotsTotal spotsAvailable availability isRecorded priceEur
  venue { id name address }
  organizer { id displayName avatarUrl }
''';

class GraphQLGamesRepository implements GamesRepository {
  GraphQLGamesRepository({String? url})
    : _client = GraphQLClient(
        link: HttpLink(url ?? defaultGamesApiUrl()),
        cache: GraphQLCache(store: InMemoryStore()),
      );

  final GraphQLClient _client;

  Future<Map<String, dynamic>> _query(
    String document, [
    Map<String, dynamic> vars = const {},
  ]) async {
    final result = await _client.query(
      QueryOptions(
        document: gql(document),
        variables: vars,
        fetchPolicy: FetchPolicy.networkOnly,
      ),
    );
    if (result.hasException) {
      final e = result.exception!;
      final message = e.graphqlErrors.isNotEmpty
          ? e.graphqlErrors.map((g) => g.message).join('; ')
          : 'Could not reach the games API (${e.linkException?.runtimeType ?? 'unknown error'}).';
      throw GamesApiException(message);
    }
    return result.data!;
  }

  static String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Future<DateTime> referenceDate() async {
    final data = await _query('query { referenceDate { today } }');
    return DateTime.parse(
      (data['referenceDate'] as Map<String, dynamic>)['today'] as String,
    );
  }

  @override
  Future<List<Game>> games({
    DateTime? from,
    DateTime? to,
    int? minSpotsAvailable,
  }) async {
    final filter = <String, dynamic>{
      if (from != null) 'dateFrom': _iso(from),
      if (to != null) 'dateTo': _iso(to),
      'minSpotsAvailable': ?minSpotsAvailable,
    };
    final data = await _query(
      'query Games(\$filter: GamesFilter) { games(filter: \$filter, first: 500) { games { $_gameFields } } }',
      {'filter': filter},
    );
    final list =
        (data['games'] as Map<String, dynamic>)['games'] as List<dynamic>;
    return list.map((j) => Game.fromJson(j as Map<String, dynamic>)).toList();
  }

  @override
  Future<Game?> game(String id) async {
    final data = await _query(
      'query Game(\$id: ID!) { game(id: \$id) { $_gameFields } }',
      {'id': id},
    );
    final g = data['game'];
    return g == null ? null : Game.fromJson(g as Map<String, dynamic>);
  }
}

class GamesApiException implements Exception {
  GamesApiException(this.message);
  final String message;
  @override
  String toString() => message;
}
