import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/States.jsx';

export const NotFoundPage = () => (
  <Card className="mx-auto max-w-lg">
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you are looking for doesn't exist or may have been moved."
      action={
        <Button as={Link} to="/dashboard">
          Back to dashboard
        </Button>
      }
    />
  </Card>
);
