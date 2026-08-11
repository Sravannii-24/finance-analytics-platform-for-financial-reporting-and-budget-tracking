from datetime import datetime
from dateutil.relativedelta import relativedelta
from models.recurring_expense import RecurringExpense, RecurringFrequency
from models.expense import Expense
from beanie import PydanticObjectId

async def run_recurring_expense_check():
    today = datetime.utcnow()
    end_of_today = today.replace(hour=23, minute=59, second=59, microsecond=999999)

    recurring_rules = await RecurringExpense.find({
        "isActive": True,
        "nextDueDate": {"$lte": end_of_today}
    }).to_list()

    print(f"[RecurringExpenseCheckService] Found {len(recurring_rules)} rules to process.")

    for rule in recurring_rules:
        try:
            desc = f"{rule.description} (Recurring)" if rule.description else 'Recurring payment'
            expense = Expense(
                user=rule.user,
                amount=rule.amount,
                category=rule.category,
                date=rule.nextDueDate,
                description=desc,
                recurringExpenseId=rule.id,
                paymentMode='Online',
                paymentMethod='Other'
            )
            await expense.insert()

            if rule.frequency == RecurringFrequency.WEEKLY:
                rule.nextDueDate = rule.nextDueDate + relativedelta(days=7)
            elif rule.frequency == RecurringFrequency.MONTHLY:
                rule.nextDueDate = rule.nextDueDate + relativedelta(months=1)

            await rule.save()
            print(f"[RecurringExpenseCheckService] Executed rule: {rule.description or rule.category} (advanced to {rule.nextDueDate.date()})")
        except Exception as e:
            print(f"[RecurringExpenseCheckService] Failed to process rule {rule.id}: {str(e)}")
