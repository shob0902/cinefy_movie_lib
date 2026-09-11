// The 404 screen.
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';
export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        title="Page not found"
        description="That link does not lead anywhere in this app."
        action={
          <Link to="/" className="linkButton">
            Back to discover
          </Link>
        }
      />
    </div>
  );
}
