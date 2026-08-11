import io
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
import services.analytics_engine as analytics_engine
from models.expense import Expense
from models.investment import Investment
from models.goal import Goal
from models.user import User

MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

def fmt_inr(value):
    return f"₹{value:,.0f}"

class ReportService:
    @staticmethod
    async def get_monthly_summary(user_id, month_str: str):
        now = datetime.now()
        current_month = month_str or f"{now.year}-{now.month:02d}"
        
        y, m = map(int, current_month.split('-'))
        prev_m = m - 1 if m > 1 else 12
        prev_y = y if m > 1 else y - 1
        prev_month = f"{prev_y}-{prev_m:02d}"

        user = await User.get(user_id)
        monthly_income = user.monthlyIncome if user else 0

        all_expenses = await Expense.find({"user": user_id}).to_list()
        investments = await Investment.find({"user": user_id}).to_list()
        goals = await Goal.find({"user": user_id}).to_list()
        
        try:
            health_score = await analytics_engine.get_health_score(user_id)
        except:
            health_score = None

        current_exp = [e for e in all_expenses if f"{e.date.year}-{e.date.month:02d}" == current_month]
        prev_exp = [e for e in all_expenses if f"{e.date.year}-{e.date.month:02d}" == prev_month]

        total_expenses = sum(e.amount for e in current_exp)
        prev_total_expenses = sum(e.amount for e in prev_exp)
        total_savings = monthly_income - total_expenses
        prev_total_savings = monthly_income - prev_total_expenses

        total_invested = sum(i.quantity * i.purchasePrice for i in investments)
        total_investment_value = sum(i.quantity * i.currentPrice for i in investments)
        net_worth = total_savings + total_investment_value

        def pct_change(curr, prev):
            if prev > 0:
                return round(((curr - prev) / prev * 100), 1)
            return 0

        CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']
        category_breakdown = []
        for cat in CATEGORIES:
            spent = sum(e.amount for e in current_exp if e.category == cat)
            prev_spent = sum(e.amount for e in prev_exp if e.category == cat)
            if spent > 0:
                category_breakdown.append({
                    "category": cat,
                    "spent": spent,
                    "prevSpent": prev_spent,
                    "pctOfTotal": round((spent / total_expenses) * 100, 1) if total_expenses > 0 else 0,
                    "changeVsPrev": pct_change(spent, prev_spent)
                })

        goal_summary = []
        for g in goals:
            progress = min(round((g.currentAmount / g.targetAmount) * 100, 1), 100) if g.targetAmount > 0 else 0
            goal_summary.append({
                "goalName": g.goalName,
                "targetAmount": g.targetAmount,
                "currentAmount": g.currentAmount,
                "progressPercent": progress,
                "status": g.status.value
            })

        month_idx = int(current_month.split('-')[1]) - 1
        return {
            "month": current_month,
            "monthLabel": f"{MONTH_NAMES[month_idx]} {current_month.split('-')[0]}",
            "summary": {
                "monthlyIncome": monthly_income,
                "totalExpenses": total_expenses,
                "totalSavings": total_savings,
                "totalInvestmentValue": total_investment_value,
                "netWorth": net_worth,
                "changes": {
                    "expenses": pct_change(total_expenses, prev_total_expenses),
                    "savings": pct_change(total_savings, prev_total_savings),
                    "investmentValue": pct_change(total_investment_value, total_invested)
                }
            },
            "categoryBreakdown": category_breakdown,
            "investmentHoldings": [
                {
                    "assetName": i.assetName,
                    "assetType": i.assetType.value,
                    "quantity": i.quantity,
                    "purchasePrice": i.purchasePrice,
                    "currentPrice": i.currentPrice,
                    "invested": i.quantity * i.purchasePrice,
                    "currentValue": i.quantity * i.currentPrice,
                    "returnPct": round(((i.currentPrice - i.purchasePrice) / i.purchasePrice) * 100, 2) if i.purchasePrice > 0 else 0
                } for i in investments
            ],
            "goalSummary": goal_summary,
            "healthScore": health_score,
            "expenses": [
                {
                    "date": e.date.isoformat() + "Z",
                    "description": e.description or "",
                    "category": e.category.value if hasattr(e.category, 'value') else e.category,
                    "amount": e.amount
                } for e in current_exp
            ]
        }

    @staticmethod
    async def generate_pdf(user_id, month_str: str) -> io.BytesIO:
        now = datetime.now()
        current_month = month_str or f"{now.year}-{now.month:02d}"
        user = await User.get(user_id)
        all_expenses = await Expense.find({"user": user_id}).to_list()
        investments = await Investment.find({"user": user_id}).to_list()
        goals = await Goal.find({"user": user_id}).to_list()
        
        try:
            hs = await analytics_engine.get_health_score(user_id)
        except:
            hs = None

        current_exp = [e for e in all_expenses if f"{e.date.year}-{e.date.month:02d}" == current_month]
        
        monthly_income = user.monthlyIncome if user else 0
        total_expenses = sum(e.amount for e in current_exp)
        total_savings = monthly_income - total_expenses
        total_investment_value = sum(i.quantity * i.currentPrice for i in investments)
        net_worth = total_savings + total_investment_value
        
        month_idx = int(current_month.split('-')[1]) - 1
        month_label = f"{MONTH_NAMES[month_idx]} {current_month.split('-')[0]}"

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Header
        c.setFillColor(colors.HexColor('#0a1628'))
        c.rect(0, height - 80, width, 80, stroke=0, fill=1)
        c.setFillColor(colors.HexColor('#10b981'))
        c.setFont("Helvetica-Bold", 24)
        c.drawString(50, height - 38, "FinSight")
        c.setFillColor(colors.white)
        c.setFont("Helvetica", 11)
        c.drawString(50, height - 60, "Personal Finance Report")
        c.setFillColor(colors.HexColor('#94a3b8'))
        c.setFont("Helvetica", 10)
        user_name = user.name if user else ""
        c.drawString(50, height - 75, f"{month_label}  |  {user_name}  |  Generated {datetime.now().strftime('%d/%m/%Y')}")

        # Summary Cards
        y = height - 120
        c.setFillColor(colors.HexColor('#1e293b'))
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, y, "Financial Summary")
        
        metrics = [
            {'label': 'Monthly Income', 'value': fmt_inr(monthly_income), 'color': '#10b981'},
            {'label': 'Total Expenses', 'value': fmt_inr(total_expenses), 'color': '#f97316'},
            {'label': 'Net Savings', 'value': fmt_inr(total_savings), 'color': '#10b981' if total_savings >= 0 else '#ef4444'},
            {'label': 'Investment Value', 'value': fmt_inr(total_investment_value), 'color': '#3b82f6'},
            {'label': 'Net Worth', 'value': fmt_inr(net_worth), 'color': '#8b5cf6'}
        ]

        y_card = y - 20
        for i, m in enumerate(metrics):
            x = 50 + (i % 2) * 255
            if i % 2 == 0 and i > 0:
                y_card -= 60
            
            c.setStrokeColor(colors.HexColor('#e2e8f0'))
            c.setFillColor(colors.HexColor('#f8fafc'))
            c.roundRect(x, y_card - 42, 245, 42, 5, stroke=1, fill=1)
            
            c.setFillColor(colors.HexColor('#64748b'))
            c.setFont("Helvetica", 9)
            c.drawString(x + 10, y_card - 15, m['label'])
            
            c.setFillColor(colors.HexColor(m['color']))
            c.setFont("Helvetica-Bold", 14)
            c.drawString(x + 10, y_card - 32, m['value'])

        y_section = y_card - 80
        c.setFillColor(colors.HexColor('#1e293b'))
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, y_section, "Expense Breakdown by Category")
        
        y_section -= 20
        c.setFillColor(colors.HexColor('#374151'))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(50, y_section, "Category")
        c.drawString(200, y_section, "Amount")
        c.drawString(300, y_section, "% of Total")
        
        c.setStrokeColor(colors.HexColor('#e5e7eb'))
        c.line(50, y_section - 5, 545, y_section - 5)
        y_section -= 20
        
        CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']
        for cat in CATEGORIES:
            spent = sum(e.amount for e in current_exp if e.category == cat)
            if spent > 0:
                pct = ((spent / total_expenses) * 100) if total_expenses > 0 else 0
                c.setFont("Helvetica", 9)
                c.drawString(50, y_section, cat)
                c.drawString(200, y_section, fmt_inr(spent))
                c.drawString(300, y_section, f"{pct:.1f}%")
                y_section -= 16

        online_spend = sum(e.amount for e in current_exp if (getattr(e, 'paymentMode', None) or getattr(e.paymentMode, 'value', 'Offline')) == 'Online')
        offline_spend = sum(e.amount for e in current_exp if (getattr(e, 'paymentMode', None) or getattr(e.paymentMode, 'value', 'Offline')) == 'Offline')
        
        y_section -= 10
        c.setFillColor(colors.HexColor('#4b5563'))
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(50, y_section, f"Payment Summary: Online Spend: {fmt_inr(online_spend)} | Offline Spend: {fmt_inr(offline_spend)}")
        
        y_section -= 30
        if investments:
            c.setFillColor(colors.HexColor('#1e293b'))
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, y_section, "Investment Holdings")
            y_section -= 20
            
            c.setFillColor(colors.HexColor('#374151'))
            c.setFont("Helvetica-Bold", 9)
            c.drawString(50, y_section, "Asset")
            c.drawString(180, y_section, "Type")
            c.drawString(260, y_section, "Invested")
            c.drawString(360, y_section, "Current Value")
            c.drawString(460, y_section, "Return")
            c.line(50, y_section - 5, 545, y_section - 5)
            y_section -= 20
            
            for inv in investments:
                invested = inv.quantity * inv.purchasePrice
                current = inv.quantity * inv.currentPrice
                ret = ((current - invested) / invested * 100) if invested > 0 else 0
                
                c.setFont("Helvetica", 8)
                c.drawString(50, y_section, inv.assetName[:18])
                c.drawString(180, y_section, inv.assetType.value if hasattr(inv.assetType, 'value') else inv.assetType)
                c.drawString(260, y_section, fmt_inr(invested))
                c.drawString(360, y_section, fmt_inr(current))
                c.setFillColor(colors.HexColor('#10b981' if ret >= 0 else '#ef4444'))
                c.drawString(460, y_section, f"{ret:.2f}%")
                c.setFillColor(colors.HexColor('#374151'))
                y_section -= 15
                
                if y_section < 50:
                    c.showPage()
                    y_section = height - 50

        if goals:
            y_section -= 20
            if y_section < 150:
                c.showPage()
                y_section = height - 50
                
            c.setFillColor(colors.HexColor('#1e293b'))
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, y_section, "Goal Progress")
            y_section -= 20
            
            c.setFillColor(colors.HexColor('#374151'))
            c.setFont("Helvetica-Bold", 9)
            c.drawString(50, y_section, "Goal")
            c.drawString(230, y_section, "Target")
            c.drawString(320, y_section, "Saved")
            c.drawString(410, y_section, "Progress")
            c.drawString(470, y_section, "Status")
            c.line(50, y_section - 5, 545, y_section - 5)
            y_section -= 20
            
            for g in goals:
                pct = min((g.currentAmount / g.targetAmount * 100), 100) if g.targetAmount > 0 else 0
                c.setFont("Helvetica", 8)
                c.drawString(50, y_section, g.goalName[:22])
                c.drawString(230, y_section, fmt_inr(g.targetAmount))
                c.drawString(320, y_section, fmt_inr(g.currentAmount))
                c.drawString(410, y_section, f"{pct:.1f}%")
                
                sc = '#10b981' if g.status.value == 'Completed' else '#ef4444' if g.status.value == 'At Risk' else '#f59e0b'
                c.setFillColor(colors.HexColor(sc))
                c.drawString(470, y_section, g.status.value)
                c.setFillColor(colors.HexColor('#374151'))
                y_section -= 15
                
                if y_section < 50:
                    c.showPage()
                    y_section = height - 50

        if hs:
            y_section -= 30
            if y_section < 200:
                c.showPage()
                y_section = height - 50
                
            c.setFillColor(colors.HexColor('#1e293b'))
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, y_section, "Financial Health Score")
            y_section -= 30
            
            c.setFillColor(colors.HexColor(hs['color']))
            c.setFont("Helvetica-Bold", 28)
            c.drawString(50, y_section, f"{hs['overall']}/100")
            c.setFillColor(colors.HexColor('#64748b'))
            c.setFont("Helvetica", 11)
            c.drawString(130, y_section, hs['label'])
            
            y_section -= 30
            for f in hs['factors']:
                c.setFillColor(colors.HexColor('#374151'))
                c.setFont("Helvetica", 9)
                c.drawString(50, y_section, f"{f['name']}: {f['score']}/100 — {f['description']}")
                y_section -= 14

        # Footer
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor('#94a3b8'))
        c.drawCentredString(width / 2.0, 30, f"Generated by FinSight on {datetime.now().strftime('%d/%m/%Y %H:%M')} | Confidential")

        c.save()
        buffer.seek(0)
        return buffer

    @staticmethod
    async def generate_excel(user_id, month_str: str) -> io.BytesIO:
        now = datetime.now()
        current_month = month_str or f"{now.year}-{now.month:02d}"
        month_idx = int(current_month.split('-')[1]) - 1
        month_label = f"{MONTH_NAMES[month_idx]} {current_month.split('-')[0]}"

        user = await User.get(user_id)
        all_expenses = await Expense.find({"user": user_id}).to_list()
        investments = await Investment.find({"user": user_id}).to_list()
        goals = await Goal.find({"user": user_id}).to_list()

        current_exp = [e for e in all_expenses if f"{e.date.year}-{e.date.month:02d}" == current_month]
        monthly_income = user.monthlyIncome if user else 0
        total_expenses = sum(e.amount for e in current_exp)
        total_savings = monthly_income - total_expenses
        total_inv_value = sum(i.quantity * i.currentPrice for i in investments)

        wb = Workbook()
        wb.remove(wb.active)
        
        header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        header_font = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
        align_center = Alignment(vertical="center", horizontal="center")
        border_bottom = Border(bottom=Side(style="thin", color="10B981"))
        inr_fmt = '₹#,##0'

        def style_header(row):
            for cell in row:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = align_center
                cell.border = border_bottom

        # ── Sheet 1: Summary ──
        ws1 = wb.create_sheet("Summary")
        ws1.column_dimensions['A'].width = 28
        ws1.column_dimensions['B'].width = 22
        
        ws1.append(["FinSight Financial Summary", month_label])
        ws1.cell(row=1, column=1).font = Font(bold=True, size=14, color="10B981")
        ws1.append([])
        
        ws1.append(["Metric", "Amount (₹)"])
        style_header(ws1[3])
        
        metrics = [
            ['Monthly Income', monthly_income],
            ['Total Expenses', total_expenses],
            ['Net Savings', total_savings],
            ['Investment Value', total_inv_value],
            ['Net Worth', total_savings + total_inv_value],
        ]
        for m in metrics:
            ws1.append(m)
            c = ws1.cell(row=ws1.max_row, column=2)
            c.number_format = inr_fmt
            if m[1] < 0:
                c.font = Font(color="EF4444")
            else:
                c.font = Font(color="10B981")
                
        ws1.append([])
        ws1.append(["Category", "Spent (₹)"])
        style_header(ws1[ws1.max_row])
        
        CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']
        for cat in CATEGORIES:
            spent = sum(e.amount for e in current_exp if getattr(e.category, 'value', e.category) == cat)
            if spent > 0:
                ws1.append([cat, spent])
                ws1.cell(row=ws1.max_row, column=2).number_format = inr_fmt

        # ── Sheet 2: Transactions ──
        ws2 = wb.create_sheet("Transactions")
        ws2.append(["Date", "Description", "Category", "Amount (₹)", "Payment Mode", "Payment Method"])
        style_header(ws2[1])
        ws2.column_dimensions['A'].width = 14
        ws2.column_dimensions['B'].width = 30
        ws2.column_dimensions['C'].width = 16
        ws2.column_dimensions['D'].width = 18
        ws2.column_dimensions['E'].width = 16
        ws2.column_dimensions['F'].width = 18
        
        for e in current_exp:
            ws2.append([
                e.date.strftime("%d/%m/%Y"),
                e.description or '',
                e.category.value if hasattr(e.category, 'value') else e.category,
                e.amount,
                getattr(e, 'paymentMode', None) or getattr(e.paymentMode, 'value', 'Offline') if hasattr(e, 'paymentMode') else 'Offline',
                getattr(e, 'paymentMethod', None) or getattr(e.paymentMethod, 'value', 'Cash') if hasattr(e, 'paymentMethod') else 'Cash',
            ])
            ws2.cell(row=ws2.max_row, column=4).number_format = inr_fmt
            
        ws2.append([])
        ws2.append(["", "", "TOTAL", total_expenses])
        ws2.cell(row=ws2.max_row, column=3).font = Font(bold=True)
        ws2.cell(row=ws2.max_row, column=4).font = Font(bold=True, color="EF4444")
        ws2.cell(row=ws2.max_row, column=4).number_format = inr_fmt

        # ── Sheet 3: Investments ──
        ws3 = wb.create_sheet("Investments")
        ws3.append(["Asset Name", "Type", "Qty", "Buy Price (₹)", "Current Price (₹)", "Invested (₹)", "Value (₹)", "Return %"])
        style_header(ws3[1])
        for col, width in zip(['A','B','C','D','E','F','G','H'], [24,14,10,16,18,16,16,12]):
            ws3.column_dimensions[col].width = width
            
        for i in investments:
            invested = i.quantity * i.purchasePrice
            val = i.quantity * i.currentPrice
            ret = ((val - invested) / invested) if invested > 0 else 0
            
            ws3.append([
                i.assetName,
                i.assetType.value if hasattr(i.assetType, 'value') else i.assetType,
                i.quantity,
                i.purchasePrice,
                i.currentPrice,
                invested,
                val,
                ret
            ])
            for col in [4, 5, 6, 7]:
                ws3.cell(row=ws3.max_row, column=col).number_format = inr_fmt
            c_ret = ws3.cell(row=ws3.max_row, column=8)
            c_ret.number_format = '0.00%'
            c_ret.font = Font(color="10B981" if ret >= 0 else "EF4444")

        # ── Sheet 4: Goals ──
        ws4 = wb.create_sheet("Goals")
        ws4.append(["Goal Name", "Target (₹)", "Saved (₹)", "Progress %", "Target Date", "Status"])
        style_header(ws4[1])
        for col, width in zip(['A','B','C','D','E','F'], [24,16,16,13,14,14]):
            ws4.column_dimensions[col].width = width
            
        for g in goals:
            pct = (g.currentAmount / g.targetAmount) if g.targetAmount > 0 else 0
            ws4.append([
                g.goalName,
                g.targetAmount,
                g.currentAmount,
                pct,
                g.targetDate.strftime("%d/%m/%Y"),
                g.status.value
            ])
            for col in [2, 3]:
                ws4.cell(row=ws4.max_row, column=col).number_format = inr_fmt
            ws4.cell(row=ws4.max_row, column=4).number_format = '0.0%'
            
            c_status = ws4.cell(row=ws4.max_row, column=6)
            sc = "10B981" if g.status.value == 'Completed' else "EF4444" if g.status.value == 'At Risk' else "F59E0B"
            c_status.font = Font(color=sc, bold=True)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
