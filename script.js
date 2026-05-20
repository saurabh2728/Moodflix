const moods = ['happy', 'sad', 'stressed', 'calm', 'excited', 'curious', 'motivated'];
const energies = ['low', 'medium', 'high'];
const paces = ['slow', 'medium', 'fast'];
const watchOptions = ['solo', 'partner', 'friends', 'family'];

const languages = Array.from(new Set(movies.map(m => m.language))).sort();
const categories = Array.from(new Set(movies.map(m => m.category))).sort();

document.addEventListener('DOMContentLoaded', () => {
  const populateSelect = (id, options) => {
    const select = document.getElementById(id);
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      select.appendChild(option);
    });
  };

  populateSelect('mood-select', moods);
  populateSelect('energy-select', energies);
  populateSelect('pace-select', paces);
  populateSelect('watch-select', watchOptions);
  
  const languageSelect = document.getElementById('language-select');
  languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      languageSelect.appendChild(option);
  });

  const categorySelect = document.getElementById('category-select');
  categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
  });

  const form = document.getElementById('recommendation-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const selectedMood = formData.get('mood');
    const selectedEnergy = formData.get('energy');
    const selectedPace = formData.get('pace');
    const selectedWatchWith = formData.get('watch_with');
    const selectedLanguage = formData.get('language');
    const selectedCategory = formData.get('category');

    getRecommendations({
      selectedMood, selectedEnergy, selectedPace, selectedWatchWith, selectedLanguage, selectedCategory
    });
  });

  // Run initial with empty filters
  getRecommendations({
    selectedMood: '', selectedEnergy: '', selectedPace: '', selectedWatchWith: '', selectedLanguage: '', selectedCategory: ''
  });
});

function getRecommendations(filters) {
  const { selectedMood, selectedEnergy, selectedPace, selectedWatchWith, selectedLanguage, selectedCategory } = filters;
  const hasUserInput = selectedMood || selectedEnergy || selectedPace || selectedWatchWith || selectedLanguage || selectedCategory;

  const filterPass = (movie, lang, cat) => {
    if (lang && movie.language !== lang) return false;
    if (cat && movie.category !== cat) return false;
    return true;
  };

  let pool = movies.filter(m => filterPass(m, selectedLanguage, selectedCategory));
  let fallbackMessage = '';

  if (hasUserInput && pool.length === 0) {
    pool = movies.filter(m => filterPass(m, selectedLanguage, ''));
    if (pool.length > 0) {
      fallbackMessage = 'No exact match for language + category. Showing best matches in selected language.';
    } else {
      pool = movies.filter(m => filterPass(m, '', ''));
      fallbackMessage = 'No exact filter match found. Showing best overall recommendations.';
    }
  }

  const featureSpace = [];
  moods.forEach(v => featureSpace.push('mood:' + v));
  languages.forEach(v => featureSpace.push('language:' + v));
  categories.forEach(v => featureSpace.push('category:' + v));
  energies.forEach(v => featureSpace.push('energy:' + v));
  paces.forEach(v => featureSpace.push('pace:' + v));
  watchOptions.forEach(v => featureSpace.push('watch:' + v));
  featureSpace.push('rating_norm', 'year_norm');

  const buildMovieVector = (movie) => {
    const vector = {};
    movie.moods.forEach(mood => vector['mood:' + mood] = 1.0);
    vector['language:' + movie.language] = 1.0;
    vector['category:' + movie.category] = 1.0;
    vector['energy:' + movie.energy] = 1.0;
    vector['pace:' + movie.pace] = 1.0;
    vector['watch:' + movie.watchWith] = 1.0;
    vector['rating_norm'] = movie.rating / 10;
    vector['year_norm'] = Math.max(0.0, Math.min(1.0, (movie.year - 1980) / 50));
    return vector;
  };

  const buildUserVector = () => {
    const vector = {};
    if (selectedMood) vector['mood:' + selectedMood] = 1.8;
    if (selectedLanguage) vector['language:' + selectedLanguage] = 1.4;
    if (selectedCategory) vector['category:' + selectedCategory] = 1.4;
    if (selectedEnergy) vector['energy:' + selectedEnergy] = 1.1;
    if (selectedPace) vector['pace:' + selectedPace] = 1.1;
    if (selectedWatchWith) vector['watch:' + selectedWatchWith] = 1.0;
    vector['rating_norm'] = 0.6;
    vector['year_norm'] = 0.3;
    return vector;
  };

  const cosineSimilarity = (a, b) => {
    let dot = 0.0, normA = 0.0, normB = 0.0;
    featureSpace.forEach(feature => {
      const av = a[feature] || 0.0;
      const bv = b[feature] || 0.0;
      dot += av * bv;
      normA += av * av;
      normB += bv * bv;
    });
    if (normA <= 0 || normB <= 0) return 0.0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const userVector = buildUserVector();
  let scoredMovies = pool.map(movie => {
    const movieVector = buildMovieVector(movie);
    const similarity = cosineSimilarity(userVector, movieVector);
    return { ...movie, match_score: Math.round(similarity * 10000) / 100 };
  });

  scoredMovies.sort((a, b) => {
    if (a.match_score === b.match_score) {
      return b.rating - a.rating;
    }
    return b.match_score - a.match_score;
  });

  const recommendations = scoredMovies.slice(0, 12);
  renderResults(recommendations, fallbackMessage);
}

function renderResults(recommendations, fallbackMessage) {
  document.getElementById('results-count').textContent = recommendations.length;
  const fallbackEl = document.getElementById('fallback-message');
  if (fallbackMessage) {
    fallbackEl.textContent = fallbackMessage;
    fallbackEl.style.display = 'block';
  } else {
    fallbackEl.style.display = 'none';
  }

  const container = document.getElementById('results-container');
  container.innerHTML = '';

  if (recommendations.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <p>No movies available right now. Please change your selections.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  recommendations.forEach(movie => {
    const fallbackPoster = 'https://placehold.co/700x1000/1e293b/e2e8f0?text=' + encodeURIComponent(movie.title);
    const article = document.createElement('article');
    article.className = 'card movie-card';

    const tagsHtml = movie.moods.map(tag => `<span>${tag.charAt(0).toUpperCase() + tag.slice(1)}</span>`).join('');

    article.innerHTML = `
      <img
        src="${movie.poster}"
        alt="${movie.title} poster"
        class="poster"
        loading="lazy"
        onerror="this.onerror=null;this.src='${fallbackPoster}';"
      />
      <div class="movie-content">
        <h3>${movie.title}</h3>
        <p class="meta">${movie.year} • ${movie.language} • ${movie.category}</p>
        <p>${movie.description}</p>
        <p class="rating">IMDb: ${movie.rating.toFixed(1)} | Model Match: ${movie.match_score.toFixed(1)}%</p>
        <p class="tags">${tagsHtml}</p>
      </div>
    `;
    grid.appendChild(article);
  });

  container.appendChild(grid);
}
