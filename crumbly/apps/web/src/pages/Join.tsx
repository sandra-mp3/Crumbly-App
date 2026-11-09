import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import RequireAuth from "./RequireAuth";

function Inner() {
  const { token } = useParams(), nav = useNavigate(), qc = useQueryClient(), [err, setErr] = useState(""), once = useRef(false);
  useEffect(() => {
    if (once.current || !token) return; once.current = true;
    api("/invites/accept", { method: "POST", body: { token } }).then(async () => { await qc.invalidateQueries({ queryKey: ["me"] }); nav("/business", { replace: true }); }).catch((e: Error) => setErr(e.message));
  }, [token, nav, qc]);
  return err ? <div className="mx-auto max-w-md p-10 text-center"><div className="text-6xl">🔒</div><p role="alert" className="my-3 text-lg">{err}</p><Link to="/" className="font-bold underline">Back to Crumbly</Link></div> : <div className="mx-auto max-w-md p-10 text-center"><p className="text-lg">Joining the team…</p></div>;
}
export default function Join() { return <RequireAuth reason="Sign in with the email you were invited at to join the team."><Inner /></RequireAuth>; }
