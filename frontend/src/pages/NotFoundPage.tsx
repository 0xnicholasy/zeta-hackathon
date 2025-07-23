import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ROUTES } from '@/config/routes';
import { useNavigateTo } from '@/types/routes';

function NotFoundPage() {
    const navigate = useNavigateTo();

    return (
        <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary flex items-center justify-center">
            <Card className="w-full max-w-md mx-4">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Page Not Found</CardTitle>
                    <CardDescription>
                        The page you're looking for doesn't exist or has been moved.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <Button
                        onClick={() => navigate(ROUTES.HOME)}
                        className="w-full bg-zeta-500 hover:bg-zeta-600"
                    >
                        Go Home
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => navigate('/dashboard')}
                        className="w-full"
                    >
                        Go to Dashboard
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default NotFoundPage;