import { useNavigate } from 'react-router-dom';

// Real equipment photography per category. This component is only used on
// the Home page, so it carries the dark editorial system rather than the
// rest of the site's light theme.
const PHOTO = {
  farming: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Kubota_M35GX_tractor_MD1.jpg/960px-Kubota_M35GX_tractor_MD1.jpg',
  construction: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Cement_mixer2.jpg/960px-Cement_mixer2.jpg',
  diy: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Extension_ladder_leaning_against_a_garage.JPG/960px-Extension_ladder_leaning_against_a_garage.JPG',
};

export default function CategoryCard({ category }) {
  const navigate = useNavigate();
  const photo = PHOTO[category.slug];
  const shortName = category.slug === 'diy' ? 'Household & DIY' : category.name.replace(' Tools', '');

  return (
    <button
      onClick={() => navigate(`/marketplace?category=${category.slug}`)}
      className="group block w-full overflow-hidden rounded-lg border border-night-border/15 bg-night-card text-left transition-colors hover:border-night-border/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-homeAccent"
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        {photo && (
          <img
            src={photo}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-semibold text-night-text">{category.name}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-homeAccent/15 px-3 py-1 text-xs font-medium text-homeAccent">
            {category.icon} {shortName}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-night-muted">{category.description}</p>
      </div>
    </button>
  );
}
