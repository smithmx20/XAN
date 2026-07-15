// lib/anilist-queries.ts
// ✅ Exact GraphQL query strings verified against AniList v2 API

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    color
  }
  bannerImage
  description
  averageScore
  episodes
  status
  genres
  season
  seasonYear
  format
  trending
  popularity
  trailer {
    id
    site
  }
  nextAiringEpisode {
    airingAt
    episode
    timeUntilAiring
  }
`;

export const TRENDING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      media(type: ANIME, sort: TRENDING_DESC) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const POPULAR_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      media(type: ANIME, sort: POPULARITY_DESC) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int, $genres: [String], $tags: [String], $sort: [MediaSort], $format: MediaFormat) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      media(type: ANIME, search: $search, genre_in: $genres, tag_in: $tags, sort: $sort, format: $format) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const AIRING_SCHEDULE_QUERY = `
  query ($page: Int, $perPage: Int, $airingAtGreater: Int, $airingAtLesser: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
        id
        airingAt
        episode
        media {
          id
          title { romaji english native }
          coverImage { large color }
          episodes
          format
          status
          averageScore
          genres
        }
      }
    }
  }
`;

export const ANIME_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english }
            coverImage { large }
            format
            status
          }
        }
      }
      characters(sort: ROLE, perPage: 12) {
        edges {
          role
          node {
            id
            name { full }
            image { medium }
          }
          voiceActors(language: JAPANESE, sort: ROLE) {
            id
            name { full }
            image { large }
            language
          }
        }
      }
      recommendations(perPage: 8) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large }
            averageScore
          }
        }
      }
    }
  }
`;

// ✅ Character detail query — fetches character info + their anime appearances
export const CHARACTER_QUERY = `
  query ($id: Int) {
    Character(id: $id) {
      id
      name {
        first
        last
        full
        native
        alternative
      }
      image {
        large
        medium
      }
      description
      dateOfBirth {
        year
        month
        day
      }
      age
      gender
      bloodType
      media(perPage: 25, sort: POPULARITY_DESC, type: ANIME) {
        edges {
          characterRole
          node {
            id
            title { romaji english }
            coverImage { large color }
            seasonYear
            format
            averageScore
            episodes
          }
        }
      }
    }
  }
`;
