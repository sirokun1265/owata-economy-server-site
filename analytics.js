(() => {
  const MEASUREMENT_ID = 'G-S65LM45F94';
  const CONSENT_KEY = 'owata_analytics_consent_v1';
  const scriptElement = document.currentScript;
  const privacyUrl = scriptElement?.dataset.privacyUrl || './privacy.html';
  let analyticsLoaded = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });

  const readConsent = () => {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch {
      return null;
    }
  };

  const saveConsent = (value) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Storage may be unavailable in a private browsing context.
    }
  };

  const clearAnalyticsCookies = () => {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (!name.startsWith('_ga')) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/owata-economy-server-site/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}; SameSite=Lax`;
    });
  };

  const loadAnalytics = () => {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.append(tag);
  };

  const hideBanner = () => document.querySelector('[data-analytics-consent]')?.remove();

  const setConsent = (value) => {
    saveConsent(value);
    hideBanner();
    if (value === 'granted') {
      loadAnalytics();
    } else {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearAnalyticsCookies();
    }
  };

  const showBanner = () => {
    if (document.querySelector('[data-analytics-consent]')) return;
    const banner = document.createElement('aside');
    banner.className = 'analytics-consent';
    banner.dataset.analyticsConsent = '';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'analytics-consent-title');
    banner.innerHTML = `
      <h2 id="analytics-consent-title">アクセス解析について</h2>
      <p>サイト改善のため、Google Analyticsで閲覧数などを測定します。広告目的のデータ利用は無効です。<a href="${privacyUrl}">詳しい説明</a></p>
      <div class="analytics-consent__actions">
        <button type="button" data-analytics-accept>同意して計測する</button>
        <button type="button" data-analytics-reject>今回は計測しない</button>
      </div>`;
    document.body.append(banner);
    banner.querySelector('[data-analytics-accept]')?.addEventListener('click', () => setConsent('granted'));
    banner.querySelector('[data-analytics-reject]')?.addEventListener('click', () => setConsent('denied'));
  };

  window.owataAnalytics = {
    resetConsent() {
      try {
        window.localStorage.removeItem(CONSENT_KEY);
      } catch {
        // Storage may be unavailable in a private browsing context.
      }
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearAnalyticsCookies();
      window.location.reload();
    },
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link || !analyticsLoaded) return;
    if (link.href.includes('discord.gg/')) {
      window.gtag('event', 'discord_join_click', { page_path: window.location.pathname });
    } else if (link.href.includes('/survey/')) {
      window.gtag('event', 'survey_open_click', { page_path: window.location.pathname });
    }
  });

  document.addEventListener('play', (event) => {
    if (!analyticsLoaded || !(event.target instanceof HTMLVideoElement) || event.target.dataset.analyticsPlayed) return;
    event.target.dataset.analyticsPlayed = 'true';
    const source = event.target.currentSrc.split('/').pop() || 'video';
    window.gtag('event', 'video_start', { video_name: source });
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('[data-analytics-reset]')?.addEventListener('click', () => window.owataAnalytics.resetConsent());
    const consent = readConsent();
    if (consent === 'granted') loadAnalytics();
    else if (consent !== 'denied') showBanner();
  });
})();
