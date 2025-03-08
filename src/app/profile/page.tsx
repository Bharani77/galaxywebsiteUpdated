"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GalaxyForm from './GalaxyForm';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlUsername = searchParams.get("username");
    
    const validateSession = async () => {
        let userId: string | null = null;
        let sessionId: string | null = null;
        let storedUsername: string | null = null;
        
        try {
            userId = sessionStorage.getItem("userId");
            sessionId = sessionStorage.getItem("sessionId");
            storedUsername = sessionStorage.getItem("username");
        } catch (error) {
            console.error('Error accessing sessionStorage:', error);
            router.push('/signin');
            return;
        }

        // First validate if URL username matches stored username
        if (urlUsername !== storedUsername) {
            sessionStorage.clear();
            toast.error('Invalid URL. Redirecting to signin...');
            router.push('/signin');
            return;
        }

        if (!userId || !sessionId) {
            // Check if there's an active session in DB
            const { data: user, error } = await supabase
                .from("users")
                .select("id, username, active_session_id")
                .eq("username", urlUsername)
                .single();

            if (error) {
                console.error('Database error:', error);
                toast.error('Error validating session');
                return;
            }

            if (user?.active_session_id) {
                // Active session exists in another tab
                try {
                    await supabase.rpc('terminate_session', { user_id: user.id });
                } catch (rpcError) {
                    console.error('Failed to terminate session:', rpcError);
                    toast.error('Error ending previous session');
                }
                sessionStorage.clear();
                router.push('/signin');
                toast.error('Duplicate session detected. Multiple tabs are not allowed.');
            } else {
                // No active session anywhere
                sessionStorage.clear();
                router.push('/signin');
                toast.error('No active session found. Please sign in.');
            }
            return;
        }

        // Validate against database
        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, active_session_id")
            .eq("id", userId)
            .single();

        if (error) {
            console.error('Database error:', error);
            toast.error('Error validating session');
            return;
        }

        if (!user || user.active_session_id !== sessionId || user.username !== urlUsername) {
            // Session is invalid or username doesn't match
            sessionStorage.clear();
            router.push('/signin');
            toast.error('Invalid session or URL. Please sign in again.');
            return;
        }
    };

    useEffect(() => {
        if (!urlUsername) {
            toast.error('Invalid URL. Redirecting to signin...', {
                onClose: () => router.push('/signin')
            });
            return;
        }

        validateSession();
        
        // Validate session every 10 seconds
        const interval = setInterval(validateSession, 10000);

        return () => clearInterval(interval);
    }, [router, urlUsername]);

    const handleLogout = () => {
        sessionStorage.clear();
        router.push('/signin');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex flex-col items-center justify-center p-4 relative">
            <button 
                className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded logoutButton" 
                onClick={handleLogout}
            >
                Logout
            </button>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            <GalaxyForm />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
