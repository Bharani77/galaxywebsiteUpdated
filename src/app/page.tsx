import Link from 'next/link';

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex flex-col items-center justify-center p-4">
            <div className="text-center mb-8">
                <h1 className="text-6xl font-bold text-white mb-4">Galaxy KickLock</h1>
                <p className="text-xsl text-purple-200">Welcome to the future of authentication</p>
            </div>
            <div className="flex gap-4">
                <Link 
                    href="/signin" 
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200"
                >
                    Sign In
                </Link>
                <Link 
                    href="/signup" 
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                >
                    Sign Up
                </Link>
            </div>
        </div>
    );
}
