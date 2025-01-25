import Link from 'next/link';

export default function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white">
            <div className="bg-[#242424] p-12 rounded-3xl shadow-xl text-center max-w-md w-full">
                <h1 className="text-5xl font-bold  mb-8">Galaxy Kick</h1>
                <div className="space-y-4">
                    <Link
                        href="/signin"
                        className="inline-block w-full px-6 py-3 bg-[#603bbb] text-white font-semibold rounded-xl hover:bg-[#34177a] transition duration-300"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/signup"
                        className="inline-block w-full px-6 py-3 bg-[#603bbb] text-white font-semibold rounded-xl hover:bg-[#34177a] transition duration-300"
                    >
                        Sign Up
                    </Link>
                </div>
            </div>
        </div>
    );
}
