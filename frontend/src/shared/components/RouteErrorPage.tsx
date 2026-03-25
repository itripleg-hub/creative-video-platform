import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let message = 'An unexpected error occurred';
  let status: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = String(error.status);
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-gray-50">
      <AlertTriangle className="h-14 w-14 text-red-400 mb-4" />
      {status && (
        <p className="text-5xl font-bold text-gray-300 mb-2">{status}</p>
      )}
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{message}</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
        <Button onClick={() => navigate('/')}>
          Home
        </Button>
      </div>
    </div>
  );
}
