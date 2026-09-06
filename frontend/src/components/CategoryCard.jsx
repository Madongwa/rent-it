import { useNavigate } from 'react-router-dom';

const THEME = {
  farming: 'from-lime-500 to-green-600',
  construction: 'from-amber-500 to-orange-600',
  diy: 'from-sky-500 to-blue-600',
};

export default function CategoryCard({ category }) {
  const navigate = useNavigate();
  const gradient = THEME[category.slug] || 'from-stone-500 to-stone-700';

  return (
    <button
      onClick={() => navigate(`/marketplace?category=${category.slug}`)}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-8 text-left text-white shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="text-5xl mb-4">{category.icon}</div>
      <h3 className="text-2xl font-bold">{category.name}</h3>
      <p className="mt-2 text-white/85">{category.description}</p>
      <span className="mt-6 inline-flex items-center gap-1 font-semibold">
        Browse {category.name}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
}
