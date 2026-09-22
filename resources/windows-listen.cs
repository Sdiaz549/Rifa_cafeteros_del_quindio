using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Globalization;
using Windows.Media.SpeechRecognition;
using Windows.Storage;

internal static class Program
{
    private static readonly HashSet<string> NumberWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "0","1","2","3","4","5","6","7","8","9",
        "cero","un","uno","una","dos","tres","cuatro","cinco","seis","siete","ocho","nueve",
        "diez","once","doce","trece","catorce","quince",
        "dieciseis","diecisiete","dieciocho","diecinueve",
        "veinte","veinti","veintiuno","veintiun","veintiuna","veintidos","veintitres",
        "veinticuatro","veinticinco","veintiseis","veintisiete","veintiocho","veintinueve",
        "treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa",
        "cien","ciento","mil",
        "doscientos","trescientos","cuatrocientos","quinientos",
        "seiscientos","setecientos","ochocientos","novecientos",
        "y"
    };

    [STAThread]
    private static int Main()
    {
        try
        {
            return Run();
        }
        catch (Exception ex)
        {
            Emit(false, null, Classify(ex));
            Console.Error.WriteLine(ex.GetType().FullName + ": " + ex.Message);
            if (ex.InnerException != null)
                Console.Error.WriteLine("inner: " + ex.InnerException.Message);
            return 1;
        }
    }

    private static int Run()
    {
        Language lang = PickLatinoSpanish();
        Console.Error.WriteLine("lang=" + lang.LanguageTag);
        string grammarPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "windows-listen.grxml");
        File.WriteAllText(grammarPath, GrammarXml(lang.LanguageTag), new UTF8Encoding(true));

        using (SpeechRecognizer rec = new SpeechRecognizer(lang))
        {
            rec.Timeouts.InitialSilenceTimeout = TimeSpan.FromSeconds(15);
            rec.Timeouts.EndSilenceTimeout = TimeSpan.FromSeconds(3.8);
            rec.Timeouts.BabbleTimeout = TimeSpan.FromSeconds(12);

            StorageFile file = WaitOp(StorageFile.GetFileFromPathAsync(grammarPath));
            rec.Constraints.Add(new SpeechRecognitionGrammarFileConstraint(file));

            SpeechRecognitionCompilationResult compiled = WaitOp(rec.CompileConstraintsAsync());
            if (compiled.Status != SpeechRecognitionResultStatus.Success)
            {
                Console.Error.WriteLine("compile=" + compiled.Status);
                Emit(false, null, "NO_ENGINE");
                return 1;
            }

            Console.WriteLine("RIFA_VOICE_READY");
            Console.Out.Flush();
            try { Console.Beep(980, 180); } catch { }

            SpeechRecognitionResult result = WaitOp(rec.RecognizeAsync());
            string status = result != null ? result.Status.ToString() : "null";
            Console.Error.WriteLine("status=" + status);
            string text = PickBest(result);
            Console.Error.WriteLine("picked=" + text);
            if (text.Length > 0)
            {
                Emit(true, text, null);
                return 0;
            }
            Emit(false, null, "NO_SPEECH");
            return 2;
        }
    }

    private static string PickBest(SpeechRecognitionResult result)
    {
        if (result == null) return "";
        List<string> candidates = new List<string>();
        AddCandidate(candidates, result.Text);
        try
        {
            IReadOnlyList<SpeechRecognitionResult> alts = result.GetAlternates(8);
            if (alts != null)
            {
                foreach (SpeechRecognitionResult alt in alts)
                {
                    if (alt != null) AddCandidate(candidates, alt.Text);
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("alts: " + ex.Message);
        }

        string best = "";
        int bestScore = int.MinValue;
        foreach (string candidate in candidates)
        {
            int score = ScoreTranscript(candidate);
            Console.Error.WriteLine("cand=" + candidate + " score=" + score);
            if (score > bestScore)
            {
                bestScore = score;
                best = candidate;
            }
        }
        return best;
    }

    private static void AddCandidate(List<string> candidates, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        string trimmed = text.Trim();
        if (candidates.Exists(c => string.Equals(c, trimmed, StringComparison.OrdinalIgnoreCase))) return;
        candidates.Add(trimmed);
    }

    private static int ScoreTranscript(string text)
    {
        string[] tokens = text.ToLowerInvariant().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length == 0) return int.MinValue;
        if (tokens.Length <= 2)
        {
            string joined = string.Join(" ", tokens);
            if (joined == "esta" || joined == "este" || joined == "si" || joined == "a ver esta" || joined == "me")
                return -50;
        }

        int score = 0;
        int numberCount = 0;
        foreach (string token in tokens)
        {
            if (NumberWords.Contains(token))
            {
                numberCount += 1;
                score += 4;
            }
            else if (token == "boleta" || token == "voleta" || token == "boletas" || token == "abono" || token == "abonar")
            {
                score += 3;
            }
            else if (token == "esta" || token == "este" || token == "si" || token == "me" || token == "se")
            {
                score -= 3;
            }
        }
        if (numberCount >= 2) score += 6;
        if (numberCount >= 3) score += 4;
        return score;
    }

    private static Language PickLatinoSpanish()
    {
        string[] prefer = { "es-CO", "es-419", "es-MX", "es-AR", "es-CL", "es-PE", "es-US", "es-ES", "es" };
        Language match = FirstMatch(SpeechRecognizer.SupportedGrammarLanguages, prefer)
            ?? FirstMatch(SpeechRecognizer.SupportedTopicLanguages, prefer)
            ?? SpeechRecognizer.SystemSpeechLanguage;
        return match ?? new Language("es-MX");
    }

    private static Language FirstMatch(IEnumerable<Language> langs, string[] prefer)
    {
        if (langs == null) return null;
        foreach (string tag in prefer)
        {
            foreach (Language lang in langs)
            {
                if (lang == null || string.IsNullOrEmpty(lang.LanguageTag)) continue;
                string t = lang.LanguageTag;
                if (t.Equals(tag, StringComparison.OrdinalIgnoreCase)) return lang;
                if (t.StartsWith(tag + "-", StringComparison.OrdinalIgnoreCase)) return lang;
                if (tag == "es" && t.StartsWith("es", StringComparison.OrdinalIgnoreCase)) return lang;
            }
        }
        return null;
    }

    private static string GrammarXml(string languageTag)
    {
        StringBuilder sb = new StringBuilder();
        sb.Append("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
        sb.Append("<grammar version=\"1.0\" xml:lang=\"").Append(languageTag);
        sb.Append("\" mode=\"voice\" root=\"utterance\" xmlns=\"http://www.w3.org/2001/06/grammar\">");

        sb.Append("<rule id=\"utterance\" scope=\"public\"><one-of>");
        sb.Append("<item weight=\"1.6\"><ruleref uri=\"#ticket\"/></item>");
        sb.Append("<item weight=\"1.4\"><item repeat=\"0-4\"><ruleref uri=\"#filler\"/></item><ruleref uri=\"#boleta\"/><ruleref uri=\"#ticket\"/></item>");
        sb.Append("<item weight=\"1.3\"><item repeat=\"0-3\"><ruleref uri=\"#filler\"/></item><ruleref uri=\"#abono\"/>");
        sb.Append("<item repeat=\"0-2\"><ruleref uri=\"#filler\"/></item><ruleref uri=\"#money\"/>");
        sb.Append("<item repeat=\"0-4\"><ruleref uri=\"#filler\"/></item><item repeat=\"0-1\"><ruleref uri=\"#boleta\"/></item>");
        sb.Append("<item repeat=\"0-1\"><ruleref uri=\"#ticket\"/></item></item>");
        sb.Append("<item weight=\"0.8\"><item repeat=\"0-3\"><ruleref uri=\"#filler\"/></item><ruleref uri=\"#abono\"/>");
        sb.Append("<item repeat=\"0-4\"><ruleref uri=\"#filler\"/></item><item repeat=\"0-1\"><ruleref uri=\"#boleta\"/></item></item>");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"ticket\"><one-of>");
        sb.Append("<item weight=\"1.5\"><item repeat=\"3-4\"><ruleref uri=\"#d0_9\"/></item></item>");
        sb.Append("<item weight=\"1.3\"><ruleref uri=\"#d0_9\"/><ruleref uri=\"#d0_9\"/><ruleref uri=\"#n00_99\"/></item>");
        sb.Append("<item weight=\"1.2\"><ruleref uri=\"#n00_99\"/><ruleref uri=\"#n00_99\"/></item>");
        sb.Append("<item weight=\"1.0\"><ruleref uri=\"#n00_99\"/></item>");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"money\"><one-of>");
        sb.Append("<item><ruleref uri=\"#n0_999\"/><item>mil</item></item>");
        sb.Append("<item><ruleref uri=\"#n0_999\"/></item>");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"n0_999\"><one-of>");
        sb.Append("<item><ruleref uri=\"#n00_99\"/></item>");
        sb.Append("<item><ruleref uri=\"#hundreds\"/><item repeat=\"0-1\"><ruleref uri=\"#n00_99\"/></item></item>");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"n00_99\"><one-of>");
        sb.Append("<item><ruleref uri=\"#d0_9\"/></item>");
        OneOf(sb, "diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve");
        sb.Append("<item>veinte</item>");
        sb.Append("<item><item>veinti</item><ruleref uri=\"#d1_9\"/></item>");
        OneOf(sb, "veintiuno", "veintiun", "veintiuna", "veintidos", "veintitres", "veinticuatro", "veinticinco", "veintiseis", "veintisiete", "veintiocho", "veintinueve");
        AppendTens(sb, "treinta");
        AppendTens(sb, "cuarenta");
        AppendTens(sb, "cincuenta");
        AppendTens(sb, "sesenta");
        AppendTens(sb, "setenta");
        AppendTens(sb, "ochenta");
        AppendTens(sb, "noventa");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"d0_9\"><one-of>");
        OneOf(sb, "cero", "uno", "una", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"d1_9\"><one-of>");
        OneOf(sb, "uno", "una", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"hundreds\"><one-of>");
        OneOf(sb, "cien", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"boleta\"><one-of>");
        OneOf(sb, "boleta", "boletas", "voleta", "ticket");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"abono\"><one-of>");
        OneOf(sb, "abono", "abonos", "abonar", "abone");
        sb.Append("</one-of></rule>");

        sb.Append("<rule id=\"filler\"><one-of>");
        OneOf(sb, "buscar", "mostrar", "ver", "abrir", "abre", "ir", "haz", "hacer", "haga", "has",
            "la", "las", "el", "los", "de", "del", "a", "al", "en", "por", "para", "un", "una",
            "numero", "pesos", "peso", "nequi", "efectivo", "transferencia");
        sb.Append("</one-of></rule>");

        sb.Append("</grammar>");
        return sb.ToString();
    }

    private static void AppendTens(StringBuilder sb, string tens)
    {
        sb.Append("<item>").Append(tens);
        sb.Append("<item repeat=\"0-1\"><item><one-of><item>y</item><item>a</item></one-of><ruleref uri=\"#d1_9\"/></item></item>");
        sb.Append("</item>");
    }

    private static void OneOf(StringBuilder sb, params string[] items)
    {
        foreach (string item in items)
            sb.Append("<item>").Append(item).Append("</item>");
    }

    private static string Classify(Exception ex)
    {
        string msg = ((ex.InnerException ?? ex).Message ?? "").ToLowerInvariant();
        if (msg.IndexOf("privacy", StringComparison.Ordinal) >= 0) return "PRIVACY";
        if (msg.IndexOf("audio", StringComparison.Ordinal) >= 0) return "NO_MIC";
        if (msg.IndexOf("micro", StringComparison.Ordinal) >= 0) return "NO_MIC";
        return "NO_ENGINE";
    }

    private static void Emit(bool ok, string text, string error)
    {
        string payload = ok
            ? "{\"ok\":true,\"text\":\"" + Escape(text) + "\"}"
            : "{\"ok\":false,\"error\":\"" + Escape(error ?? "NO_SPEECH") + "\"}";
        Console.WriteLine("RIFA_VOICE:" + payload);
        Console.Out.Flush();
    }

    private static string Escape(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        return value.Replace("\\", " ").Replace("\"", "'").Replace("\r", " ").Replace("\n", " ");
    }

    private static T WaitOp<T>(IAsyncOperation<T> op)
    {
        using (ManualResetEvent wait = new ManualResetEvent(false))
        {
            Exception error = null;
            T value = default(T);
            op.Completed = (info, status) =>
            {
                try { value = info.GetResults(); }
                catch (Exception ex) { error = ex; }
                wait.Set();
            };
            wait.WaitOne();
            if (error != null) throw error;
            return value;
        }
    }
}
