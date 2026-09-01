import React, { useState, useEffect, useRef } from "react";
import {
    FileText,
    Download,
    Mail,
    Filter,
    Calendar,
    User,
    Briefcase,
    Settings,
    Loader2,
    CheckCircle2,
    Copy,
    LayoutDashboard,
    Zap,
    Cpu,
    MousePointer2,
    Terminal,
    ShieldCheck,
    PlusCircle,
    Clock,
    Search,
    ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import html2pdf from "html2pdf.js";
import axios from "axios";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

// Data
import { PROJECT_LIST, RESOURCE_LIST } from "./data";

// --- Constants ---
const DEFAULT_MANAGER = "Rajini Mam";
const APP_TITLE = "GA Performance Tracker";

export default function App() {
    // --- State ---
    const [groqApiKey, setGroqApiKey] = useState(
        import.meta.env.VITE_GROQ_API_KEY ||
            localStorage.getItem("groq_api_key") ||
            "",
    );
    const [apiBaseUrl, setApiBaseUrl] = useState(
        localStorage.getItem("api_base_url") || "https://api.mistral.ai/v1"
    );
    const [sheetUrl, setSheetUrl] = useState(
        import.meta.env.VITE_SHEET_URL ||
            localStorage.getItem("sheet_url") ||
            "",
    );
    const [sheetName, setSheetName] = useState(
        import.meta.env.VITE_SHEET_NAME ||
            localStorage.getItem("sheet_name") ||
            "Sheet1",
    );
    const [selectedModel, setSelectedModel] = useState(
        localStorage.getItem("selected_model") || ""
    );
    const [availableModels, setAvailableModels] = useState([]);

    const [fromDate, setFromDate] = useState("2026-08-01");
    const [toDate, setToDate] = useState("2026-08-31");
    const [filterName, setFilterName] = useState("Pramod");
    const [filterProject, setFilterProject] = useState("All Projects");
    const [role, setRole] = useState("Developer");

    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);

    const reportRef = useRef();

    // --- Effects ---
    useEffect(() => {
        localStorage.setItem("groq_api_key", groqApiKey);
        localStorage.setItem("api_base_url", apiBaseUrl);
        localStorage.setItem("sheet_url", sheetUrl);
        localStorage.setItem("sheet_name", sheetName);
        localStorage.setItem("selected_model", selectedModel);
    }, [groqApiKey, apiBaseUrl, sheetUrl, sheetName, selectedModel]);

    useEffect(() => {
        if (groqApiKey && apiBaseUrl) {
            fetch(`${apiBaseUrl.replace(/\/$/, '')}/models`, {
                headers: { Authorization: `Bearer ${groqApiKey}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.data) {
                    const models = data.data.map(m => m.id).filter(id => !id.toLowerCase().includes("whisper"));
                    console.log(models)
                    setAvailableModels(models);
                    
                    if (!selectedModel || !models.includes(selectedModel)) {
                        if (models.includes("mistral-medium-3.5")) {
                            setSelectedModel("mistral-medium-3.5");
                        } else if (models.includes("mistral-medium-latest")) {
                            setSelectedModel("mistral-medium-latest");
                        } else if (models.includes("mistral-medium")) {
                            setSelectedModel("mistral-medium");
                        } else if (models.includes("llama-3.3-70b-versatile")) {
                            setSelectedModel("llama-3.3-70b-versatile");
                        } else if (models.includes("llama-3.1-70b-versatile")) {
                            setSelectedModel("llama-3.1-70b-versatile");
                        } else if (models.includes("groq/compound")) {
                            setSelectedModel("groq/compound");
                        } else if (models.includes("groq/compound-mini")) {
                            setSelectedModel("groq/compound-mini");
                        } else if (models.length > 0) {
                            setSelectedModel(models[0]);
                        }
                    }
                }
            })
            .catch(console.error);
        }
        
    }, [groqApiKey]);

    // --- Helpers ---
    const parseCSV = (csvText) => {
        const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length === 0) return [];

        const parseLine = (line) => {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === "," && !inQuotes) {
                    result.push(current.trim());
                    current = "";
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result.map((v) => v.replace(/^"|"$/g, "").trim());
        };

        const headers = parseLine(lines[0]);
        console.log("DEBUG: Sheet Headers Found:", headers); // Help user identify columns

        return lines.slice(1).map((line) => {
            const values = parseLine(line);
            return headers.reduce((obj, header, i) => {
                obj[header] = values[i] || "";
                obj[`_col${i}`] = values[i] || ""; // Save by index too
                return obj;
            }, {});
        });
    };

    const formatDuration = (decimalHours) => {
        const totalSeconds = Math.round(decimalHours * 3600);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const parseHours = (value) => {
        if (!value) return 0;
        const str = String(value).trim();
        if (str.includes(":")) {
            const parts = str.split(":");
            const h = parseFloat(parts[0]) || 0;
            const m = parseFloat(parts[1]) || 0;
            const s = parseFloat(parts[2]) || 0;
            return h + m / 60 + s / 3600;
        }
        return parseFloat(str) || 0;
    };

    const fetchSheetData = async () => {
        if (!sheetUrl) return [];
        try {
            const sheetIdMatch = sheetUrl.match(/\/d\/(.*?)(\/|$)/);
            const gidMatch = sheetUrl.match(/gid=([0-9]*)/);

            if (!sheetIdMatch) throw new Error("Invalid Google Sheet URL");
            const sheetId = sheetIdMatch[1];
            const gid = gidMatch ? gidMatch[1] : null;

            let csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
            if (gid) {
                csvUrl += `&gid=${gid}`;
            } else {
                csvUrl += `&sheet=${encodeURIComponent(sheetName)}`;
            }

            const response = await axios.get(csvUrl);
            return parseCSV(response.data);
        } catch (err) {
            console.error("Error fetching sheet:", err);
            return getMockData();
        }
    };

    const getMockData = () => {
        return [
            {
                Date: "2026-03-01",
                Resource: "Pramod Motupalli",
                Project: "G A Hire Sync",
                Activity: "WebSocket implementation",
                "Activity Break-up 1": "Auto-refresh logic",
                "Activity Break-up 2": "Backend integration",
                "Total Hours": "6",
                Comment: "Implemented successfully",
            },
            {
                Date: "2026-03-02",
                Resource: "Pramod Motupalli",
                Project: "G A Hire Sync",
                Activity: "Payment Gateway",
                "Activity Break-up 1": "Razorpay API",
                "Activity Break-up 2": "Credit system logic",
                "Total Hours": "8",
            },
        ];
    };

    const generateReport = async () => {
        console.log("DEBUG: generateReport triggered");
        if (!groqApiKey) {
            setError(
                "Please provide Groq/Llama API Key in .env or contact admin.",
            );
            // setShowConfig(true); // Don't show config anymore as keys are hidden
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const rawData = await fetchSheetData();

            const findValue = (row, keyName) => {
                const key = Object.keys(row).find(
                    (k) => k.toLowerCase().trim() === keyName.toLowerCase(),
                );
                if (key && row[key]) return row[key];

                // Fallbacks for the missing headers in this specific sheet
                const keyLower = keyName.toLowerCase();
                if (keyLower === "date") return row._col1 || "";
                if (keyLower === "resource" || keyLower === "employee") return row._col3 || "";
                if (keyLower === "project" || keyLower === "client") return row._col4 || "";
                if (keyLower === "activity" || keyLower === "planned activity for the day") return row._col5 || "";
                if (keyLower === "total hours") return row._col6 || "";

                return "";
            };

            // 1. Calculate stats based on ALL data for this resource in the date range (ignoring project filter for stats)
            const parseISO = (str) => {
                if (!str) return null;
                // Handle YYYY-MM-DD and potentially DD-MM-YYYY or MM/DD/YYYY
                // For simplicity, we assume YYYY-MM-DD or standard JS-parseable format
                // We set to noon to avoid timezone shift issues
                const d = new Date(str);
                if (isNaN(d.getTime())) return null;
                d.setHours(12, 0, 0, 0);
                return d;
            };

            const resourceData = rawData.filter((row) => {
                const dateStr = findValue(row, "Date");
                const resourceValue =
                    findValue(row, "Resource") ||
                    findValue(row, "Employee") ||
                    "";
                const nameMatch = filterName
                    ? resourceValue
                          .toLowerCase()
                          .includes(filterName.toLowerCase().trim())
                    : true;

                const rowDate = parseISO(dateStr);
                const start = parseISO(fromDate);
                const end = parseISO(toDate);

                return (
                    nameMatch &&
                    (rowDate && start && end
                        ? rowDate >= start && rowDate <= end
                        : false)
                );
            });

            let totalLeaveDays = 0;
            let totalHoursCount = 0;
            const projectHours = {};
            const uniqueDates = [
                ...new Set(resourceData.map((r) => findValue(r, "Date"))),
            ];

            uniqueDates.forEach((d) => {
                const dayLogs = resourceData.filter(
                    (r) => findValue(r, "Date") === d,
                );
                let dayLeaveScore = 0;

                dayLogs.forEach((r) => {
                    const rawHours = findValue(r, "Total Hours");
                    const hours = parseHours(rawHours);
                    totalHoursCount += hours;

                    let proj =
                        findValue(r, "Project") || findValue(r, "Client") || "";
                    const activity = (findValue(r, "Activity") || "").trim();

                    // If project is empty or "Daily Huddle" / "Leave" is in activity, prioritize activity as category
                    if (
                        !proj ||
                        activity.toLowerCase().includes("huddle") ||
                        activity.toLowerCase().includes("leave")
                    ) {
                        if (activity.toLowerCase().includes("huddle"))
                            proj = "Daily Huddle";
                        else if (activity.toLowerCase().includes("leave"))
                            proj = "Leave";
                        else if (!proj) proj = "Uncategorized";
                    }

                    projectHours[proj] = (projectHours[proj] || 0) + hours;

                    const act = (
                        findValue(r, "Activity") +
                        findValue(r, "Project") +
                        findValue(r, "Comment")
                    ).toLowerCase();
                    if (act.includes("leave") || act.includes("holiday")) {
                        if (act.includes("half")) {
                            dayLeaveScore = Math.max(dayLeaveScore, 0.5);
                        } else {
                            dayLeaveScore = 1.0;
                        }
                    }
                });
                totalLeaveDays += dayLeaveScore;
            });

            const stats = {
                totalDays: uniqueDates.length - totalLeaveDays,
                leaveDays: totalLeaveDays,
                totalHours: totalHoursCount.toFixed(2),
                formattedTotalHours: formatDuration(totalHoursCount),
                primaryProject:
                    filterProject && filterProject !== "All Projects"
                        ? filterProject
                        : "Various Projects",
                projectHours: Object.entries(projectHours).map(
                    ([name, hours]) => ({
                        name,
                        hours: hours.toFixed(2),
                        formattedHours: formatDuration(hours),
                    }),
                ),
            };

            // 2. Filter content for the AI based on the Project filter
            if (resourceData.length === 0) {
                throw new Error(
                    `No logs found for ${filterName} in the selected date range (${fromDate} to ${toDate}).`
                );
            }

            const contentData = resourceData.filter((row) => {
                if (!filterProject || filterProject === "All Projects")
                    return true;
                const projectValue =
                    findValue(row, "Project") || findValue(row, "Client") || "";
                return projectValue
                    .toLowerCase()
                    .includes(filterProject.toLowerCase().trim());
            });

            if (contentData.length === 0) {
                throw new Error(
                    `Data Mismatch: Found ${uniqueDates.length} days of logs for ${filterName}, but 0 rows matched the project "${filterProject}".`,
                );
            }

            // 3. Minimize AI Payload (Save Cost)
            // Only send columns the AI needs to understand the work content
            const aiPayload = contentData.map((r) => ({
                D: findValue(r, "Date"), // Added date context
                PR: findValue(r, "Project"),
                A:
                    findValue(r, "Planned Activity for the Day") ||
                    findValue(r, "Activity") ||
                    r._col5,
                H: findValue(r, "Total Hours"),
            }));

            console.log("DEBUG: Data being sent to AI (minimized):", aiPayload);

            const devSections = [
                {
                    id: 1,
                    title: "Functionalities Being Rolled Out",
                    items: ["string"],
                },
                {
                    id: 2,
                    title: "Process Optimization Ideas",
                    items: ["string"],
                },
                { id: 3, title: "X-Factor Deliverables", items: ["string"] },
                { id: 4, title: "UI/UX Refinements", items: ["string"] },
                {
                    id: 5,
                    title: "Third-Party API Integrations",
                    items: ["string"],
                },
                {
                    id: 6,
                    title: "Maintenance and Stability",
                    items: ["string"],
                },
            ];

            const designerSections = [
                {
                    id: 1,
                    title: "Artwork & Video Design Performance",
                    items: ["string"],
                },
                { id: 2, title: "UI/UX Design Performance", items: ["string"] },
                { id: 3, title: "Logo Design Performance", items: ["string"] },
                { id: 4, title: "Cross-Team Contribution", items: ["string"] },
            ];

            const activeSections =
                role === "Designer" ? designerSections : devSections;

            const prompt = `
        Analyze these work logs and generate a professional monthly report in JSON for a ${role}.
        Employee: ${filterName}
        Period: ${fromDate} to ${toDate}
        
        STATS (DO NOT CHANGE THESE):
        - Total Effective Working Days: ${stats.totalDays}
        - Total Leave/Holiday Days: ${stats.leaveDays}
        - Total Hours Worked: ${stats.totalHours}
        - Primary Focus: ${stats.primaryProject}

        DATA: ${JSON.stringify(aiPayload)}

        RULES:
        1. Perform a deep analysis of each log and distribute them logically across ALL provided sections. Avoid grouping everything into one section.
        2. Ensure every section has relevant content if data is available in the logs.
        3. Maintain highly professional and concise bullet points.
        4. In "distribution", the percentages MUST sum exactly to 100%. 
        5. CRITICAL: OUTPUT ONLY VALID JSON. Do NOT wrap your response in markdown code blocks (e.g. no \`\`\`json). Provide only the raw JSON object.
        
        RESPONSE FORMAT:
        {
          "summary": {
            "totalDays": ${stats.totalDays},
            "leaveDays": ${stats.leaveDays},
            "totalHours": ${stats.totalHours},
            "primaryProject": "${stats.primaryProject}",
            "distribution": { "Primary Execution": 0, "Creative/Testing": 0, "Meetings": 0 }
          },
          "sections": ${JSON.stringify(activeSections)}
        }
      `;

            // --- AI API Selection ---
            if (groqApiKey) {
                const requestBody = {
                    model: selectedModel || "mistral-medium-3.5",
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are a professional performance analyst. Categorize work logs into the provided sections based on their primary function and deliver professional results in JSON.",
                        },
                        { role: "user", content: prompt },
                    ],
                    temperature: 0.2,
                    max_tokens: 4000,
                };

                const response = await fetch(
                    `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${groqApiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(requestBody),
                    },
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(
                        `Groq API Error: ${errorData.error?.message || response.statusText}`,
                    );
                }

                const data = await response.json();
                let rawContent = data.choices[0].message.content || "";
                console.log("DEBUG AI Response:", rawContent);
                
                // 1. Remove <think>...</think> blocks entirely (reasoning models)
                rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "");

                // 2. Strip markdown formatting if the model adds it
                const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match) {
                    rawContent = match[1];
                }
                
                // 3. Fallback: extract just the JSON object if there's surrounding text
                const jsonStart = rawContent.indexOf('{');
                const jsonEnd = rawContent.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
                    rawContent = rawContent.substring(jsonStart, jsonEnd + 1);
                } else {
                    throw new Error("AI did not return any JSON object. It may have run out of tokens or failed to follow instructions.");
                }
                
                let reportData;
                try {
                    reportData = JSON.parse(rawContent.trim());
                } catch (parseError) {
                    console.error("JSON Parse Error:", parseError);
                    console.error("Truncated JSON string:", rawContent);
                    throw new Error("AI output was cut off and resulted in incomplete JSON. The model may have hit its max_tokens limit. Try reducing the date range (e.g. 1 week at a time) or switching models.");
                }

                // Inject our local stats (including project hours) into the report
                reportData.summary = {
                    ...reportData.summary,
                    projectHours: stats.projectHours,
                    formattedTotalHours: stats.formattedTotalHours,
                };

                setReport(reportData);
            }
        } catch (err) {
            setError(
                err.message || "An error occurred while generating the report.",
            );
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = () => {
        const element = reportRef.current;

        // Safety check for modern color functions (oklab/oklch) which crash html2canvas
        const opt = {
            margin: 10,
            filename: `Report_${filterName}_${fromDate}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                onclone: (document) => {
                    // 1. Remove ALL modern stylesheets that might contain oklch/oklab
                    const styles = document.querySelectorAll(
                        'style, link[rel="stylesheet"]',
                    );
                    styles.forEach((s) => s.remove());

                    // 2. Inject a Minimal, Standard-CSS-Only stylesheet for the PDF
                    const pdfStyle = document.createElement("style");
                    pdfStyle.innerHTML = `
            .printable-report { font-family: Arial, sans-serif; color: #1e293b; background: white; padding: 40px; }
            .printable-report h2 { font-size: 32pt; font-weight: bold; margin-bottom: 10px; }
            .printable-report h3 { font-size: 10pt; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
            .printable-report h4 { font-size: 14pt; font-weight: 800; color: #1e293b; }
            .printable-report .flex { display: flex; }
            .printable-report .grid { display: grid; }
            .printable-report .grid-cols-2 { grid-template-columns: 1fr 1fr; }
            .printable-report .gap-12 { gap: 3rem; }
            .printable-report .gap-6 { gap: 1.5rem; }
            .printable-report .space-y-16 > * + * { margin-top: 4rem; }
            .printable-report .space-y-8 > * + * { margin-top: 2rem; }
            .printable-report .space-y-6 > * + * { margin-top: 1.5rem; }
            .printable-report .space-y-4 > * + * { margin-top: 1rem; }
            .printable-report .bg-slate-50 { background-color: #f8fafc; border-radius: 1rem; padding: 1.5rem; border: 1px solid #f1f5f9; }
            .printable-report .bg-indigo-50 { background-color: #eef2ff; border-radius: 1rem; padding: 1.5rem; border: 1px solid #e0e7ff; }
            .printable-report .h-2 { height: 0.5rem; background-color: #f1f5f9; border-radius: 9999px; overflow: hidden; }
            .printable-report .bg-indigo-600 { background-color: #4f46e5; height: 100%; }
            .printable-report .border-t { border-top: 1px solid #f1f5f9; padding-top: 2rem; }
            .printable-report .text-slate-500 { color: #64748b; font-size: 9pt; }
            .printable-report .text-indigo-600 { color: #4f46e5; }
            .printable-report ul { list-style: none; padding: 0; }
            .printable-report li { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
            .printable-report .bullet { height: 6px; width: 6px; background-color: #818cf8; border-radius: 50%; margin-top: 6px; }
          `;
                    document.head.appendChild(pdfStyle);
                },
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };

        html2pdf().from(element).set(opt).save();
    };

    const copyEmailDraft = () => {
        const projectBreakdown = report.summary.projectHours
            .map((p) => `  * ${p.name}: ${p.formattedHours}`)
            .join("\n");
        const emailBody = `Respected ${DEFAULT_MANAGER},\n\nWorking report for ${new Date(fromDate).toLocaleString("default", { month: "long", year: "numeric" })}\n\nOverall Report Summary:\n\n* Total active working days: ${report.summary.totalDays}\n* Total hours worked: ${report.summary.formattedTotalHours}\n* Leave days: ${report.summary.leaveDays} full days\n\n* Project Breakdown:\n${projectBreakdown}\n* Grand Total = ${report.summary.formattedTotalHours}\n\n* Work distribution:\n${Object.entries(
            report.summary.distribution,
        )
            .map(([key, val]) => `  * ${key}: ${val}%`)
            .join(
                "\n",
            )}\n\n${report.sections.map((s) => `\n${s.id}. ${s.title}\n\n${s.items.map((item) => `* ${item}`).join("\n")}`).join("\n")}\n\nBest regards,\n${filterName}`;
        navigator.clipboard.writeText(emailBody.trim());
        alert("Email draft copied to clipboard!");
    };

    const SectionIcon = ({ id }) => {
        const icons = {
            1: <LayoutDashboard size={18} className="text-blue-500" />,
            2: <Cpu size={18} className="text-purple-500" />,
            3: <Zap size={18} className="text-amber-500" />,
            4: <MousePointer2 size={18} className="text-pink-500" />,
            5: <Terminal size={18} className="text-green-500" />,
            6: <ShieldCheck size={18} className="text-red-500" />,
        };
        return icons[id] || <PlusCircle size={18} />;
    };

    return (
        <div className="relative min-h-screen p-6 md:p-12">
            <div className="bg-gradient-mesh" />

            <main className="relative z-10 max-w-6xl mx-auto space-y-10">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fade-in">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gradient gradient-indigo-amber pb-1 tracking-tight">
                            {APP_TITLE}
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">
                            Enterprise performance intelligence & analytics
                        </p>
                    </div>

                    <div className="flex items-center gap-3 no-print">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfig(!showConfig)}
                        >
                            <Settings className="mr-2 h-4 w-4" /> Config
                        </Button>
                        <Button
                            variant="premium"
                            onClick={generateReport}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="mr-2 h-4 w-4" />
                            )}
                            Generate Report
                        </Button>
                    </div>
                </header>

                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse relative z-50"
                        >
                            <ShieldCheck className="h-5 w-5" />
                            <p className="text-sm font-medium">{error}</p>
                            <Button variant="ghost" size="sm" className="ml-auto text-red-600 hover:bg-red-100" onClick={() => setError(null)}>Dismiss</Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Config Panel */}
                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm">
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">
                                            API Key
                                        </label>
                                        <Input 
                                            type="password"
                                            value={groqApiKey} 
                                            onChange={(e) => setGroqApiKey(e.target.value)}
                                            placeholder="sk-..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">
                                            API Base URL
                                        </label>
                                        <Input 
                                            value={apiBaseUrl} 
                                            onChange={(e) => setApiBaseUrl(e.target.value)}
                                            placeholder="https://api.mistral.ai/v1"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">
                                            Google Sheet URL
                                        </label>
                                        <Input
                                            value={sheetUrl}
                                            onChange={(e) =>
                                                setSheetUrl(e.target.value)
                                            }
                                            placeholder="https://docs.google.com/spreadsheets/d/..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">
                                            Sheet Tab Name
                                        </label>
                                        <Input
                                            value={sheetName}
                                            onChange={(e) =>
                                                setSheetName(e.target.value)
                                            }
                                            placeholder="e.g. Sheet1"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">
                                            AI Model
                                        </label>
                                        <Select
                                            value={selectedModel}
                                            onValueChange={setSelectedModel}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableModels.length === 0 ? (
                                                    <SelectItem value={selectedModel || "mistral-medium-3.5"}>
                                                        {selectedModel || "Loading..."}
                                                    </SelectItem>
                                                ) : (
                                                    availableModels.map(modelId => (
                                                        <SelectItem key={modelId} value={modelId}>
                                                            {modelId}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-slate-400">Models fetched automatically from your API key</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Filter Panel */}
                <Card className="glass-card border-none shadow-xl overflow-visible">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-600">
                            <Filter className="h-5 w-5" /> Report Parameters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Calendar size={14} /> Start Date
                            </label>
                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Calendar size={14} /> End Date
                            </label>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <User size={14} /> Resource
                            </label>
                            <Select
                                value={filterName}
                                onValueChange={setFilterName}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Resource" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RESOURCE_LIST.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Briefcase size={14} /> Role
                            </label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Developer">
                                        Developer
                                    </SelectItem>
                                    <SelectItem value="Designer">
                                        Designer
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Briefcase size={14} /> Project (Optional)
                            </label>
                            <Select
                                value={filterProject}
                                onValueChange={(val) => setFilterProject(val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Project" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All Projects">
                                        All Projects
                                    </SelectItem>
                                    {PROJECT_LIST.map((proj) => (
                                        <SelectItem key={proj} value={proj}>
                                            {proj}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Display Area */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-24 text-center space-y-4"
                        >
                            <div className="h-16 w-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                            <div className="space-y-1">
                                <p className="text-xl font-bold text-slate-800">
                                    AI is distilling your impact...
                                </p>
                                <p className="text-slate-500">
                                    Synthesizing logs into professional
                                    milestones
                                </p>
                            </div>
                        </motion.div>
                    ) : report ? (
                        <motion.div
                            key="report"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-8"
                        >
                            <div className="flex justify-end gap-3 no-print">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowEmailModal(true)}
                                >
                                    <Mail className="mr-2 h-4 w-4" /> Email
                                    Draft
                                </Button>
                                {/* <Button variant="premium" onClick={downloadPDF}>
                  <Download className="mr-2 h-4 w-4" /> Export PDF
                </Button> */}
                            </div>

                            {/* The Actual Report */}
                            <div
                                ref={reportRef}
                                style={{
                                    backgroundColor: "white",
                                    color: "#0f172a",
                                }}
                                className="printable-report p-10 md:p-16 space-y-16 bg-white border-none shadow-2xl"
                            >
                                <div className="border-b border-slate-100 pb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                    <div className="space-y-2">
                                        <h2 className="text-5xl font-bold tracking-tighter text-slate-900 line-clamp-1">
                                            Performance Insight
                                        </h2>
                                        <p className="text-indigo-600 font-bold uppercase tracking-[0.3em] text-sm">
                                            {new Date(fromDate).toLocaleString(
                                                "default",
                                                {
                                                    month: "long",
                                                    year: "numeric",
                                                },
                                            )}{" "}
                                            Report
                                        </p>
                                    </div>
                                    <div className="text-sm text-slate-500 space-y-1 md:text-right">
                                        <p className="flex items-center md:justify-end gap-2">
                                            Manager:{" "}
                                            <span className="text-slate-900 font-bold">
                                                {DEFAULT_MANAGER}
                                            </span>
                                        </p>
                                        <p>
                                            ID: GA-
                                            {Math.random()
                                                .toString(36)
                                                .substr(2, 6)
                                                .toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    <div className="space-y-8">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                                            KPI Summary
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                                                <p className="text-slate-500 text-xs font-bold uppercase mb-1">
                                                    Active Days
                                                </p>
                                                <p className="text-4xl font-black text-slate-800 tracking-tighter">
                                                    {report.summary.totalDays}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                                                <p className="text-slate-500 text-xs font-bold uppercase mb-1">
                                                    Leave Balance
                                                </p>
                                                <p className="text-4xl font-black text-slate-800 tracking-tighter">
                                                    {report.summary.leaveDays}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                                                <p className="text-slate-500 text-xs font-bold uppercase mb-1">
                                                    Total Hours
                                                </p>
                                                <p className="text-4xl font-black text-slate-800 tracking-tighter">
                                                    {
                                                        report.summary
                                                            .formattedTotalHours
                                                    }
                                                </p>
                                            </div>
                                            <div className="col-span-2 bg-gradient-to-br from-indigo-50 to-white p-6 rounded-3xl border border-indigo-100/50 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <p className="text-indigo-600 text-xs font-bold uppercase">
                                                        Project Breakdown
                                                    </p>
                                                    <p className="text-indigo-600 text-xs font-bold uppercase">
                                                        Total Hours
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    {report.summary.projectHours.map(
                                                        (proj, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex justify-between items-center text-sm"
                                                            >
                                                                <span className="text-slate-700 font-medium">
                                                                    {proj.name}
                                                                </span>
                                                                <span className="text-slate-900 font-bold font-mono">
                                                                    {
                                                                        proj.formattedHours
                                                                    }
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                    <div className="pt-2 mt-2 border-t border-indigo-100 flex justify-between items-center text-sm font-black text-indigo-900">
                                                        <span>
                                                            Grand Total =
                                                        </span>
                                                        <span className="font-mono">
                                                            {
                                                                report.summary
                                                                    .formattedTotalHours
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                                            Work Portfolio
                                        </h3>
                                        <div className="space-y-6 pt-2">
                                            {Object.entries(
                                                report.summary.distribution,
                                            ).map(([key, value]) => (
                                                <div
                                                    key={key}
                                                    className="space-y-2"
                                                >
                                                    <div className="flex justify-between text-sm font-semibold">
                                                        <span className="text-slate-600 uppercase text-[11px] tracking-wider">
                                                            {key}
                                                        </span>
                                                        <span className="text-slate-900">
                                                            {value}%
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{
                                                                width: 0,
                                                            }}
                                                            animate={{
                                                                width: `${value}%`,
                                                            }}
                                                            transition={{
                                                                duration: 1.5,
                                                                ease: "easeOut",
                                                            }}
                                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12 border-t border-slate-100 pt-16">
                                    {report.sections.map((section) => (
                                        <div
                                            key={section.id}
                                            className="space-y-6 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 group-hover:scale-110 transition-transform shadow-sm">
                                                    <SectionIcon
                                                        id={section.id}
                                                    />
                                                </div>
                                                <h4 className="text-lg font-black text-slate-800 tracking-tight">
                                                    {section.title}
                                                </h4>
                                            </div>
                                            <ul className="space-y-4">
                                                {section.items.map(
                                                    (item, i) => (
                                                        <li
                                                            key={i}
                                                            className="flex gap-4 text-[13px] text-slate-500 leading-relaxed items-start group-hover:text-slate-700 transition-colors"
                                                        >
                                                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-200 mt-2 shrink-0 group-hover:bg-indigo-500 transition-colors" />
                                                            {typeof item ===
                                                            "object"
                                                                ? item.task ||
                                                                  item.description ||
                                                                  JSON.stringify(
                                                                      item,
                                                                  )
                                                                : item}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-16 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 text-[11px] text-slate-400 uppercase font-bold tracking-[0.2em]">
                                    <p>Authenticated by Llama Intelligence</p>
                                    <div className="text-center sm:text-right">
                                        <p className="text-slate-900 text-lg tracking-normal font-black mb-1">
                                            {filterName}
                                        </p>
                                        <p>Software Engineer</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-32 space-y-6"
                        >
                            <div className="h-24 w-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                                <FileText className="h-10 w-10 text-indigo-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-slate-800">
                                    No report generated yet
                                </h3>
                                <p className="text-slate-500 max-w-sm mx-auto">
                                    Configure your source and filter parameters
                                    to synthesize your performance insights.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Email Dialog */}
            <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black flex items-center gap-3">
                            <Mail className="text-indigo-600" /> Professional
                            Broadcast Draft
                        </DialogTitle>
                    </DialogHeader>
                    <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 font-mono text-[13px] h-[50vh] overflow-y-auto my-6 text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {report &&
                            `Respected ${DEFAULT_MANAGER},\n\nWorking report for ${new Date(fromDate).toLocaleString("default", { month: "long", year: "numeric" })}\n\nOverall Report Summary:\n\n* Total active working days: ${report.summary.totalDays}\n* Total hours worked: ${report.summary.formattedTotalHours}\n* Leave days: ${report.summary.leaveDays} full days\n\n* Project Breakdown:\n${report.summary.projectHours.map((p) => `  * ${p.name}: ${p.formattedHours}`).join("\n")}\n* Grand Total = ${report.summary.formattedTotalHours}\n\n* Work distribution:\n${Object.entries(
                                report.summary.distribution,
                            )
                                .map(([key, val]) => `  * ${key}: ${val}%`)
                                .join(
                                    "\n",
                                )}\n\n${report.sections.map((s) => `\n${s.id}. ${s.title}\n\n${s.items.map((item) => `* ${item}`).join("\n")}`).join("\n")}\n\nBest regards,\n${filterName}`}
                    </div>
                    <DialogFooter className="gap-3 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setShowEmailModal(false)}
                        >
                            Refine
                        </Button>
                        <Button variant="premium" onClick={copyEmailDraft}>
                            <Copy className="mr-2 h-4 w-4" /> Copy Broadcast
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
