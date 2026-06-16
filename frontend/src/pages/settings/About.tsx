import { ArrowLeft, Info, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'

const AboutPage = () => {
  return (
    <Layout showNav={false}>
      <div className="p-4 pb-20">
        <div className="mb-6">
          <Link to="/settings" className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>返回设置</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info size={48} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">AthleteOS</h1>
          <p className="text-text-secondary">版本 1.1.0 (MVP)</p>
          <p className="text-sm text-text-secondary mt-1">Build 20260616</p>
        </div>

        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">产品介绍</h3>
          <div className="space-y-3 text-text-secondary text-sm">
            <p>
              AthleteOS 是专为中国耐力运动爱好者打造的训练决策支持工具。基于你的训练数据，结合运动科学算法，为你提供个性化的训练建议，帮助你科学训练，避免受伤，稳步提升运动表现。
            </p>
            <p>
              我们的核心理念是"低焦虑、专业化、健康导向"，不做复杂的数据看板，不做社交攀比，专注于为你提供清晰、可执行的每日训练指导。
            </p>
          </div>
        </div>

        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">核心功能</h3>
          <ul className="space-y-2 text-text-secondary text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>基于 Intervals.icu 数据的智能训练建议</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>ACWR、训练单调性、训练负荷等专业指标计算</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>8项硬性安全规则，保护训练安全</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>动态调整功能，根据当日状态智能调整训练</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>每周复盘总结，提供训练改进建议</span>
            </li>
          </ul>
        </div>

        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">数据来源</h3>
          <p className="text-sm text-text-secondary">
            本产品所有训练数据均来自 <span className="text-status-info font-medium">Intervals.icu</span> API，
            不会存储你的原始运动文件，也不会将你的数据分享给任何第三方。
          </p>
        </div>

        <div className="card mb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-3">免责声明</h3>
          <div className="space-y-2 text-xs text-text-secondary">
            <p>
              AthleteOS 提供的训练建议仅供参考，不构成医疗建议或专业训练指导。训练前请确保你的身体状况适合进行相应强度的运动。
            </p>
            <p>
              运动存在固有风险，在开始任何新的训练计划之前，请咨询专业医生或教练的意见。如在训练过程中感到不适，请立即停止并寻求专业帮助。
            </p>
            <p>
              使用本产品即表示你已理解并同意，AthleteOS 不对任何因使用本产品建议而导致的伤害或损失承担责任。
            </p>
          </div>
        </div>

        <div className="text-center text-xs text-text-muted">
          <p className="flex items-center justify-center gap-1 mb-1">
            <Heart size={12} className="text-status-danger" />
            Made with love for endurance athletes
          </p>
          <p>© 2026 AthleteOS. All rights reserved.</p>
        </div>
      </div>
    </Layout>
  )
}

export default AboutPage
