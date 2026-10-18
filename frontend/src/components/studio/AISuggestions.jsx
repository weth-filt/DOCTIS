import { motion } from "framer-motion";
import { FaArrowUp, FaShieldAlt } from "react-icons/fa";
import useLiveReducedMotion from "../useLiveReducedMotion";
import "../../CSS/patient-functions.css";

const QUESTIONS = ["Cần lưu ý gì khi theo dõi đường huyết?", "Gợi ý bữa tối phù hợp", "Vận động nhẹ mỗi ngày như thế nào?"];

export default function AISuggestions({ onChoose, disabled = false }) {
  const reduced = useLiveReducedMotion();
  return <div className="ai-assistance-tools"><div className="ai-suggestion-chips" role="group" aria-label="Gợi ý câu hỏi">{QUESTIONS.map((question, index) => <motion.button key={question} type="button" onClick={() => onChoose?.(question)} disabled={disabled} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .2, delay: reduced ? 0 : index * .04 }}>{question}<FaArrowUp /></motion.button>)}</div><p className="ai-medical-disclaimer"><FaShieldAlt aria-hidden="true" /><span>Thông tin AI chỉ để tham khảo, không thay thế chẩn đoán hoặc hướng dẫn điều trị của bác sĩ.</span></p></div>;
}
