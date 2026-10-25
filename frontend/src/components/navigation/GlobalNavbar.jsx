"use client";

import { useState } from "react";
import {
    BrainCircuit,
    FolderTree,
    LogOut,
    User,
    ChevronRight,
    Sparkles,
    MapPin,
    Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";

export default function GlobalNavbar({ currentView, userName = "Alex Hunter", onNavigate, onSelectMap, onSignOut }) {
    const [isMapsDrawerOpen, setIsMapsDrawerOpen] = useState(false);

    // Mock existing user maps dataset
    const [userMaps] = useState([
        { id: "map-1", title: "Master Graph Algorithms (DSA)", nodesCount: 6, updated: "2h ago", status: "In Progress" },
        { id: "map-2", title: "SFU Signaling & WebRTC Failover", nodes: 8, updated: "Yesterday", status: "Pending" },
        { id: "map-3", title: "Supabase & pgvector RAG Pipeline", nodes: 5, updated: "3 days ago", status: "Completed" },
    ]);

    return (
        <div className="w-full px-6 pt-3 shrink-0 z-50 sticky top-0">
            <header className="h-14 w-full bg-[#191B20]/90 border border-[#343434] backdrop-blur-md rounded-2xl px-5 flex items-center justify-between shadow-xl">

                {/* 1. LEFT: BRANDING & CURRENT VIEW */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => onNavigate?.("home")}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                            O
                        </div>
                        <span className="font-bold text-xs tracking-wider uppercase text-white font-mono">
                            Organizer
                        </span>
                    </button>

                    <span className="text-[#343434] text-xs">/</span>

                    <Badge variant="outline" className="border-[#343434] bg-[#2B2A2F]/50 text-[10px] text-[#9CA3AF] py-0.5 px-2 h-5 font-normal capitalize">
                        {currentView}
                    </Badge>
                </div>

                {/* 2. CENTER-RIGHT: EXISTING MAPS DRAWER TRIGGER */}
                <div className="flex items-center gap-3">
                    <Drawer open={isMapsDrawerOpen} onOpenChange={setIsMapsDrawerOpen} direction="bottom">
                        <DrawerTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-[#2B2A2F] border-[#343434] hover:border-[#696973] text-white text-xs h-9 px-3 gap-2 rounded-xl shadow-sm transition-all group"
                            >
                                <FolderTree className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Existing Maps</span>
                                <Badge className="bg-[#191B20] text-indigo-300 text-[10px] border border-[#343434] ml-1">
                                    {userMaps.length}
                                </Badge>
                            </Button>
                        </DrawerTrigger>

                        {/* Existing Maps Drawer */}
                        <DrawerContent className="bg-[#191B20] border-t border-[#343434] text-[#E5E7EB] h-[65vh] flex flex-col p-6 font-sans">
                            <div className="max-w-4xl w-full mx-auto flex flex-col h-full space-y-4">

                                <DrawerHeader className="px-0 pt-0 pb-3 border-b border-[#343434] flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                                            <BrainCircuit className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <DrawerTitle className="text-white text-base font-bold">
                                                Your Existing Study Maps
                                            </DrawerTitle>
                                            <p className="text-[11px] text-[#696973]">
                                                Select any map below to jump straight into its active timer workspace.
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs text-[#696973] border-[#343434]">
                                        Synced with Supabase
                                    </Badge>
                                </DrawerHeader>

                                {/* Map Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 overflow-y-auto flex-1">
                                    {userMaps.map((map) => (
                                        <div
                                            key={map.id}
                                            className="p-4 bg-[#2B2A2F] border border-[#343434] hover:border-indigo-500/50 rounded-2xl flex flex-col justify-between transition-all group cursor-pointer shadow-md"
                                            onClick={() => {
                                                setIsMapsDrawerOpen(false);
                                                onSelectMap?.(map.id);
                                            }}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Badge
                                                        className={`text-[9px] border ${map.status === "Completed"
                                                                ? "bg-emerald-950 text-emerald-400 border-emerald-500/40"
                                                                : "bg-indigo-950 text-indigo-300 border-indigo-500/40"
                                                            }`}
                                                    >
                                                        {map.status}
                                                    </Badge>
                                                    <span className="text-[10px] text-[#696973]">{map.updated}</span>
                                                </div>
                                                <h3 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                                    {map.title}
                                                </h3>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-[#343434] flex items-center justify-between text-[11px]">
                                                <span className="text-[#696973]">{map.nodesCount} Execution Blocks</span>
                                                <span className="text-indigo-400 flex items-center gap-0.5 font-medium group-hover:translate-x-1 transition-transform">
                                                    Open <ChevronRight className="w-3 h-3" />
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </DrawerContent>
                    </Drawer>

                    <div className="h-5 w-px bg-[#343434]" />

                    {/* 3. RIGHT: PROFILE NAME & SIGN-OUT LOGO */}
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                                {userName.split(" ").map(n => n[0]).join("")}
                            </div>
                            <span className="text-xs font-medium text-slate-200">{userName}</span>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSignOut}
                            title="Sign Out"
                            className="h-8 w-8 text-[#9CA3AF] hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>

                </div>

            </header>
        </div>
    );
}