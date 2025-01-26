"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlUsername = searchParams.get("username");
    
    const validateSession = async () => {
        const userId = sessionStorage.getItem("userId");
        const sessionId = sessionStorage.getItem("sessionId");
        const storedUsername = sessionStorage.getItem("username");

        // First validate if URL username matches stored username
        if (urlUsername !== storedUsername) {
            sessionStorage.clear();
            toast.error('Invalid URL. Redirecting to signin...', {
                onClose: () => router.push('/signin')
            });
            return;
        }

        if (!userId || !sessionId) {
            // Check if there's an active session in DB
            const { data: user, error } = await supabase
                .from("users")
                .select("id, username, active_session_id")
                .eq("username", urlUsername)
                .single();

            if (user && user.active_session_id) {
                // Active session exists in another tab
                await supabase.rpc('terminate_session', { user_id: user.id });
                sessionStorage.clear();
                toast.error('Duplicate session detected. Multiple tabs are not allowed.', {
                    onClose: () => router.push('/signin')
                });
            } else {
                // No active session anywhere
                sessionStorage.clear();
                toast.error('No active session found. Please sign in.', {
                    onClose: () => router.push('/signin')
                });
            }
            return;
        }

        // Validate against database
        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, active_session_id")
            .eq("id", userId)
            .single();

        if (error || !user || user.active_session_id !== sessionId || user.username !== urlUsername) {
            // Session is invalid or username doesn't match
            sessionStorage.clear();
            toast.error('Invalid session or URL. Please sign in again.', {
                onClose: () => router.push('/signin')
            });
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex flex-col items-center justify-center p-4">
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
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-lg max-w-md w-full">
                <h1 className="text-2xl font-bold text-white mb-4">
                    Hello,{" "}
                    <span className="text-purple-300">
                        {urlUsername ? urlUsername : "Guest"}
                    </span>
                    !
                </h1>
                {/* Add other content or components here */}
            </div>
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
