import { useState } from 'react';

const WORDS = ['ambition', 'persévérance', 'joie', 'audace'];

const WORD_COLORS = {
  ambition:     { text: 'text-blue-600',   bg: 'bg-blue-50'   },
  persévérance: { text: 'text-emerald-600', bg: 'bg-emerald-50' },
  joie:         { text: 'text-amber-500',  bg: 'bg-amber-50'  },
  audace:       { text: 'text-rose-600',   bg: 'bg-rose-50'   },
};

// ── Citations Pôle France Relève ─────────────────────────────────────────────
const POLE_QUOTES = [
  {
    quote:  "La confiance s'acquiert en goutte et se perd en litre.",
    author: "Pierre Mouton", role: "Coach",
    img: "/pole/pierre.jpg",
  },
  {
    quote:  "La réussite se compte en années et les défaites en heures.",
    author: "Maël Lamouret", role: "Archer",
    img: "/pole/lamouret.jpg",
  },
  {
    quote:  "Tu sais qu'on ne peut toucher au but qu'après s'être fait transformer par le voyage.",
    author: "Maël Kharchouf", role: "Archer",
    img: "/pole/kharchouf.jpg",
  },
  {
    quote:  "Entre l'envie et le regret il y a un point qui s'appelle le présent.",
    author: "Maël Kharchouf", role: "Archer",
    img: "/pole/kharchouf.jpg",
  },
  {
    quote:  "La confiance c'est ce que tu accordes à ce que tu sais déjà faire, et c'est ce que tu génères en faisant.",
    author: "Gilles Topandé-Makombo", role: "Archer",
    img: "/pole/gilles.jpg",
  },
  {
    quote:  "J'ai fait de mon mieux mais mon mieux c'est de la merde.",
    author: "Siham Er'rahmouni", role: "Archer",
    img: "/pole/siham.jpg",
  },
];

// ── 30 citations de sportifs — photos Wikipedia Commons ──────────────────────
const QUOTES = [
  {
    quote:  "Impossible est un mot qu'on trouve dans le dictionnaire des lâches.",
    author: "Muhammad Ali", sport: "Boxe 🥊",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Muhammad_Ali_NYWTS.jpg/330px-Muhammad_Ali_NYWTS.jpg",
  },
  {
    quote:  "Je peux accepter l'échec, tout le monde échoue. Mais je ne peux pas accepter de ne pas essayer.",
    author: "Michael Jordan", sport: "Basketball 🏀",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Michael_Jordan_in_2014.jpg/330px-Michael_Jordan_in_2014.jpg",
  },
  {
    quote:  "Si tu n'es plus dépassé par certaines choses, c'est parce que tu ne vas plus assez vite.",
    author: "Ayrton Senna", sport: "Formule 1 🏎️",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Ayrton_Senna_9_%28cropped%29.jpg/330px-Ayrton_Senna_9_%28cropped%29.jpg",
  },
  {
    quote:  "Le succès, c'est du travail acharné, de la persévérance et surtout de l'amour pour ce que tu fais.",
    author: "Pelé", sport: "Football ⚽",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Pele_con_brasil_%28cropped%29.jpg/330px-Pele_con_brasil_%28cropped%29.jpg",
  },
  {
    quote:  "Tu rates 100 % des tirs que tu ne tentes pas.",
    author: "Wayne Gretzky", sport: "Hockey 🏒",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Andrew_Scheer_with_Wayne_Gretzky_%2848055697168%29_%28cropped%29.jpg/330px-Andrew_Scheer_with_Wayne_Gretzky_%2848055697168%29_%28cropped%29.jpg",
  },
  {
    quote:  "Le talent sans travail n'est que du talent gâché.",
    author: "Zinedine Zidane", sport: "Football ⚽",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg/330px-Zinedine_Zidane_by_Tasnim_03.jpg",
  },
  {
    quote:  "Les héros se révèlent dans les moments difficiles.",
    author: "Kobe Bryant", sport: "Basketball 🏀",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Kobe_Bryant_Dec_2014.jpg/330px-Kobe_Bryant_Dec_2014.jpg",
  },
  {
    quote:  "Je ne joue pas pour être deuxième.",
    author: "Serena Williams", sport: "Tennis 🎾",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Guests_at_the_2026_Met_Gala_209_%28cropped%29.jpg/330px-Guests_at_the_2026_Met_Gala_209_%28cropped%29.jpg",
  },
  {
    quote:  "Crois en toi et tout devient possible.",
    author: "Novak Djokovic", sport: "Tennis 🎾",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Novak_Djokovic_2024_Paris_Olympics.jpg/330px-Novak_Djokovic_2024_Paris_Olympics.jpg",
  },
  {
    quote:  "Je voulais prouver que tout est possible quand on s'y donne vraiment.",
    author: "Michael Phelps", sport: "Natation 🏊",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Michael_Phelps_Rio_Olympics_2016.jpg/330px-Michael_Phelps_Rio_Olympics_2016.jpg",
  },
  {
    quote:  "La médaille, c'est la conséquence du travail, jamais l'objectif.",
    author: "Martin Fourcade", sport: "Biathlon ⛷️",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Martin_Fourcade_octobre_2017.jpg/330px-Martin_Fourcade_octobre_2017.jpg",
  },
  {
    quote:  "Réalise que tu as en toi quelque chose de plus grand que n'importe quel obstacle.",
    author: "Jesse Owens", sport: "Athlétisme 🏃",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Jesse_Owens_1936.jpg/330px-Jesse_Owens_1936.jpg",
  },
  {
    quote:  "Je ne fais pas confiance aux mots, je fais confiance aux actions.",
    author: "Simone Biles", sport: "Gymnastique 🤸",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Simone_Biles_National_Team_2024.jpg/330px-Simone_Biles_National_Team_2024.jpg",
  },
  {
    quote:  "La victoire se prépare dans l'ombre.",
    author: "Marie-José Pérec", sport: "Athlétisme 🏃",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Marie-Jos%C3%A9_P%C3%A9rec_Cannes_2016.jpg/330px-Marie-Jos%C3%A9_P%C3%A9rec_Cannes_2016.jpg",
  },
  {
    quote:  "Donne tout ce que tu as — tu n'auras alors rien à regretter.",
    author: "Zinedine Zidane", sport: "Football ⚽",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg/330px-Zinedine_Zidane_by_Tasnim_03.jpg",
  },
  {
    quote:  "Il faut oser rêver grand pour accomplir de grandes choses.",
    author: "Renaud Lavillenie", sport: "Saut à la perche 🏅",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/2014_D%C3%A9caNation_-_Pole_vault_14.jpg/330px-2014_D%C3%A9caNation_-_Pole_vault_14.jpg",
  },
  {
    quote:  "Le football est simple, mais il est difficile de jouer simplement.",
    author: "Johan Cruyff", sport: "Football ⚽",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Johan_Cruijff_%281974%29.jpg/330px-Johan_Cruijff_%281974%29.jpg",
  },
  {
    quote:  "Ne regarde jamais en arrière, sauf pour voir d'où tu viens.",
    author: "Florence Griffith-Joyner", sport: "Athlétisme 🏃",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Florence_Griffith_Joyner2.jpg/330px-Florence_Griffith_Joyner2.jpg",
  },
  {
    quote:  "La plus grande victoire, c'est celle que l'on remporte sur soi-même.",
    author: "Roger Federer", sport: "Tennis 🎾",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Roger_Federer_2015_%28cropped%29.jpg/330px-Roger_Federer_2015_%28cropped%29.jpg",
  },
  {
    quote:  "Pour gagner, il faut d'abord croire que tu peux.",
    author: "Carl Lewis", sport: "Athlétisme 🏃",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Carl_Lewis_%28cropped%29.jpg/330px-Carl_Lewis_%28cropped%29.jpg",
  },
  {
    quote:  "La douleur est temporaire. Abandonner est éternel.",
    author: "Lance Armstrong", sport: "Cyclisme 🚴",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Lance_Armstrong_%28Tour_Down_Under_2009%29.jpg/330px-Lance_Armstrong_%28Tour_Down_Under_2009%29.jpg",
  },
  {
    quote:  "Sois meilleur qu'hier, moins bon que demain.",
    author: "Haile Gebrselassie", sport: "Marathon 🏃",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Olympic_great_Haile_Gebrselassie_speaking_at_the_Olympic_hunger_summit_in_Downing_Street%2C_12_August_2012_%28cropped%29.jpg/330px-Olympic_great_Haile_Gebrselassie_speaking_at_the_Olympic_hunger_summit_in_Downing_Street%2C_12_August_2012_%28cropped%29.jpg",
  },
  {
    quote:  "Un champion, c'est quelqu'un qui se relève quand il ne peut pas.",
    author: "Jack Dempsey", sport: "Boxe 🥊",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Jack_Dempsey_1.jpg/330px-Jack_Dempsey_1.jpg",
  },
  {
    quote:  "Le sport, c'est le seul endroit où je sais exactement ce que je vaux.",
    author: "Rafael Nadal", sport: "Tennis 🎾",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rafael_Nadal_en_2024_%28cropped%29.jpg/330px-Rafael_Nadal_en_2024_%28cropped%29.jpg",
  },
  {
    quote:  "Il faut souffrir pour être beau… et champion.",
    author: "Teddy Riner", sport: "Judo 🥋",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Teddy_Riner_Cannes_2016.jpg/330px-Teddy_Riner_Cannes_2016.jpg",
  },
  {
    quote:  "Je remets tout en question, c'est ce qui m'a rendu si bon.",
    author: "LeBron James", sport: "Basketball 🏀",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg/330px-LeBron_James_%2851959977144%29_%28cropped2%29.jpg",
  },
  {
    quote:  "Le talent ne suffit pas. Il faut du travail et la volonté de progresser.",
    author: "Cristiano Ronaldo", sport: "Football ⚽",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/330px-Cristiano_Ronaldo_2018.jpg",
  },
  {
    quote:  "Les champions ne sont pas faits dans les salles de gym. Ils sont faits d'un désir, d'un rêve, d'une vision.",
    author: "Muhammad Ali", sport: "Boxe 🥊",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Muhammad_Ali_NYWTS.jpg/330px-Muhammad_Ali_NYWTS.jpg",
  },
  {
    quote:  "Je m'entraîne pour être le meilleur, donc je dois m'entraîner comme le meilleur.",
    author: "Teddy Riner", sport: "Judo 🥋",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Teddy_Riner_Cannes_2016.jpg/330px-Teddy_Riner_Cannes_2016.jpg",
  },
  {
    quote:  "Chaque victoire commence par la décision d'essayer.",
    author: "Usain Bolt", sport: "Sprint 💨",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Usain_Bolt_smiling_Berlin_2009.JPG/330px-Usain_Bolt_smiling_Berlin_2009.JPG",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomOther(current, max) {
  let next;
  do { next = Math.floor(Math.random() * max); } while (next === current && max > 1);
  return next;
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function WelcomeScreen({ userName, role = 'coach' }) {
  const [word] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  // 50/50 : showPole détermine le pool, chaque index est indépendant
  const [showPole, setShowPole]     = useState(() => Math.random() < 0.5);
  const [poleIdx,  setPoleIdx]      = useState(() => Math.floor(Math.random() * POLE_QUOTES.length));
  const [sportsIdx, setSportsIdx]   = useState(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86_400_000);
    return dayOfYear % QUOTES.length;
  });
  const [imgError, setImgError] = useState(false);

  const firstName = userName?.split(' ')[0] ?? userName ?? '';
  const isPole    = showPole;
  const current   = isPole ? POLE_QUOTES[poleIdx] : QUOTES[sportsIdx];
  const { quote, author, img } = current;
  const sport     = isPole ? null : current.sport;
  const colors    = WORD_COLORS[word] ?? WORD_COLORS.ambition;

  function handleNextQuote() {
    const nextIsPole = Math.random() < 0.5;
    setShowPole(nextIsPole);
    if (nextIsPole) setPoleIdx(i => randomOther(i, POLE_QUOTES.length));
    else            setSportsIdx(i => randomOther(i, QUOTES.length));
    setImgError(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 px-6 text-center">

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="text-6xl mb-5 select-none">🏹</div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-3 leading-snug">
          Bonjour, {firstName} 👋
        </h1>

        <p className="text-lg text-gray-500 leading-relaxed">
          {role === 'coach'
            ? <>Es-tu prêt à entraîner avec{' '}<span className={`font-bold ${colors.text}`}>{word}</span> aujourd'hui ?</>
            : <>Es-tu prêt à t'entraîner avec{' '}<span className={`font-bold ${colors.text}`}>{word}</span> aujourd'hui ?</>
          }
        </p>
      </div>

      {/* ── Carte citation ────────────────────────────────────── */}
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden max-w-xl w-full ${
        isPole ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
      }`}>

        {/* En-tête */}
        <div className={`px-6 pt-5 pb-3 ${isPole ? 'bg-gradient-to-r from-blue-50 to-white' : ''}`}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            {isPole ? '🏹 Parole du Pôle France Relève' : '💬 Citation sportive du jour'}
          </p>
        </div>

        {/* Corps : photo + texte côte à côte */}
        <div className="flex gap-5 px-6 pb-5 items-start">

          {/* Photo */}
          <div className="shrink-0 w-24 h-28 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
            {(!img || imgError) ? (
              <span className="text-4xl select-none">
                {isPole ? '🏹' : sport?.split(' ').pop()}
              </span>
            ) : (
              <img
                src={img}
                alt={author}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-top"
              />
            )}
          </div>

          {/* Texte */}
          <div className="flex-1 min-w-0 text-left">
            {/* Badge */}
            {isPole ? (
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3 bg-blue-100 text-blue-700">
                🏹 Pôle France Relève
              </span>
            ) : (
              <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3 ${colors.bg} ${colors.text}`}>
                {sport}
              </span>
            )}

            {/* Guillemet décoratif */}
            <blockquote className="text-gray-800 text-sm leading-relaxed italic mb-3 relative">
              <span className="text-3xl text-gray-200 font-serif leading-none absolute -top-1 -left-1">"</span>
              <span className="pl-4">{quote}</span>
            </blockquote>

            <p className="text-xs font-bold text-gray-500">
              — {author}
              {isPole && current.role && (
                <span className="ml-1.5 font-normal text-gray-400">· {current.role}</span>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={handleNextQuote}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold transition"
          >
            Nouvelle citation
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 4v5h.582m0 0a8 8 0 0115.356 2M4.582 9H9m11 11v-5h-.581m0 0a8 8 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {role === 'coach' && (
        <p className="mt-8 text-sm text-gray-400">
          Sélectionnez un archer dans la liste pour commencer 👈
        </p>
      )}
    </div>
  );
}
