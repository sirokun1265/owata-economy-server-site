document.documentElement.classList.add('js-ready');

const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');
const modal = document.querySelector('.video-modal');
const modalVideo = modal?.querySelector('video');

menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));

document.querySelector('[data-video-open]')?.addEventListener('click', () => {
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalVideo?.play().catch(() => {});
});

document.querySelector('[data-video-close]')?.addEventListener('click', () => {
  modal.hidden = true;
  document.body.style.overflow = '';
  modalVideo?.pause();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal && !modal.hidden) {
    modal.hidden = true;
    document.body.style.overflow = '';
    modalVideo?.pause();
  }
});

const revealElements = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

const roles = [
  { image: './public/media/market-street.png', eyebrow: 'SHOP OWNER', title: '売れる仕組みを、自分でつくる。', description: '土地を選び、商品を並べ、価格を決める。プレイヤーショップや自動販売機、NPC店舗を使って、自分だけの商売を育てよう。', steps: ['土地を探す', '商品を仕入れる', 'お店を育てる'] },
  { image: './public/media/investment-city.png', eyebrow: 'INVESTOR', title: '街の成長を読み、未来に投資する。', description: '会社の株を買い、売買のタイミングを考える。自分で会社をつくり、株式を発行する遊び方にも挑戦できます。', steps: ['会社を知る', '株を売買する', '資産を育てる'] },
  { image: './public/media/railway-city.png', eyebrow: 'RAILWAY CEO', title: '一本の線路から、街を動かす。', description: '路線と駅をつくり、運賃を設定。乗り換えを含む運賃収益が各社へ配分される、本格的な鉄道経営が待っています。', steps: ['会社を設立', '駅と路線を整備', '街をつなぐ'] },
  { image: './public/media/logistics-network.png', eyebrow: 'CRAFT & GROW', title: '働くほど、できることが増えていく。', description: '木こり、採掘、整地などの仕事で経験を重ね、レベルアップ。初めてでも、街の経済に参加するところから始められます。', steps: ['仕事を選ぶ', '報酬を得る', '次の挑戦へ'] },
];

document.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', () => {
  const index = Number(button.dataset.role);
  const role = roles[index];
  if (!role) return;
  document.querySelectorAll('[data-role]').forEach((item) => {
    item.classList.toggle('is-active', item === button);
    item.setAttribute('aria-selected', String(item === button));
  });
  document.querySelector('#role-image').src = role.image;
  document.querySelector('#role-eyebrow').textContent = role.eyebrow;
  document.querySelector('#role-title').textContent = role.title;
  document.querySelector('#role-description').textContent = role.description;
  document.querySelector('#role-steps').innerHTML = role.steps.map((step, stepIndex) => `<li><b>${stepIndex + 1}</b>${step}</li>`).join('');
}));
