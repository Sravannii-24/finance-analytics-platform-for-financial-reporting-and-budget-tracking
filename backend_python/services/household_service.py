import random
import string
from fastapi import HTTPException
from models.user import User
from models.household import Household, HouseholdMember, Role
from models.budget import Budget
from models.goal import Goal

class HouseholdService:
    @staticmethod
    async def generate_invite_code() -> str:
        exists = True
        code = ""
        while exists:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            existing = await Household.find_one({"inviteCode": code})
            if not existing:
                exists = False
        return code

    @staticmethod
    async def create_household(user_id, name: str) -> Household:
        user = await User.get(user_id)
        if user.household:
            raise HTTPException(status_code=400, detail={"success": False, "message": "You are already in a household"})
        
        invite_code = await HouseholdService.generate_invite_code()
        household = Household(
            name=name,
            owner=user_id,
            members=[HouseholdMember(user=user_id, role=Role.OWNER)],
            inviteCode=invite_code
        )
        await household.insert()
        
        user.household = household.id
        await user.save()
        return household

    @staticmethod
    async def join_household(user_id, invite_code: str) -> Household:
        user = await User.get(user_id)
        if user.household:
            raise HTTPException(status_code=400, detail={"success": False, "message": "You are already in a household"})
            
        household = await Household.find_one({"inviteCode": invite_code})
        if not household:
            raise HTTPException(status_code=404, detail={"success": False, "message": "Household not found with this invite code"})
            
        household.members.append(HouseholdMember(user=user_id, role=Role.MEMBER))
        await household.save()
        
        user.household = household.id
        await user.save()
        return household

    @staticmethod
    async def get_household(user_id) -> dict:
        user = await User.get(user_id)
        if not user.household:
            return None
            
        household = await Household.get(user.household)
        if not household:
            raise HTTPException(status_code=404, detail={"success": False, "message": "Household not found"})
            
        # Manually populate members & owner
        owner = await User.get(household.owner)
        owner_dict = {"_id": str(owner.id), "name": owner.name, "email": owner.email}
        
        members_data = []
        for m in household.members:
            m_user = await User.get(m.user)
            if m_user:
                members_data.append({
                    "user": {
                        "_id": str(m_user.id),
                        "name": m_user.name,
                        "email": m_user.email,
                        "monthlyIncome": m_user.monthlyIncome
                    },
                    "role": m.role.value,
                    "joinedAt": m.joinedAt.isoformat() + "Z"
                })
        
        hh_dict = household.model_dump()
        hh_dict["_id"] = str(household.id)
        hh_dict["owner"] = owner_dict
        hh_dict["members"] = members_data
        
        return hh_dict

    @staticmethod
    async def mark_budget_shared(user_id, budget_id) -> Budget:
        user = await User.get(user_id)
        if not user.household:
            raise HTTPException(status_code=400, detail={"success": False, "message": "You must belong to a household to share resources"})
            
        from beanie import PydanticObjectId
        try:
            b_id = PydanticObjectId(budget_id)
        except:
            raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid budget ID"})
            
        budget = await Budget.get(b_id)
        if not budget:
            raise HTTPException(status_code=404, detail={"success": False, "message": "Budget not found"})
            
        if str(budget.user) != str(user_id):
            raise HTTPException(status_code=403, detail={"success": False, "message": "Only the budget owner can mark it as shared"})
            
        budget.household = user.household
        await budget.save()
        return budget

    @staticmethod
    async def leave_household(user_id):
        user = await User.get(user_id)
        if not user.household:
            raise HTTPException(status_code=400, detail={"success": False, "message": "You are not a member of this household"})
            
        household = await Household.get(user.household)
        if not household:
            raise HTTPException(status_code=404, detail={"success": False, "message": "Household not found"})
            
        member_idx = next((i for i, m in enumerate(household.members) if str(m.user) == str(user_id)), -1)
        if member_idx == -1:
            raise HTTPException(status_code=400, detail={"success": False, "message": "You are not listed in this household"})
            
        role = household.members[member_idx].role
        
        if role == Role.OWNER:
            member_ids = [m.user for m in household.members]
            await User.find({"_id": {"$in": member_ids}}).update({"$set": {"household": None}})
            await Budget.find({"household": household.id}).update({"$set": {"household": None}})
            await Goal.find({"household": household.id}).update({"$set": {"household": None}})
            await household.delete()
            return "Household dissolved successfully"
        else:
            household.members.pop(member_idx)
            await household.save()
            user.household = None
            await user.save()
            return "Left household successfully"

    @staticmethod
    async def remove_member(owner_id, household_id, user_id_to_remove):
        from beanie import PydanticObjectId
        try:
            h_id = PydanticObjectId(household_id)
            u_id = PydanticObjectId(user_id_to_remove)
        except:
            raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid ID"})
            
        household = await Household.get(h_id)
        if not household:
            raise HTTPException(status_code=404, detail={"success": False, "message": "Household not found"})
            
        if str(household.owner) != str(owner_id):
            raise HTTPException(status_code=403, detail={"success": False, "message": "Only the household owner can remove members"})
            
        if str(owner_id) == str(user_id_to_remove):
            raise HTTPException(status_code=400, detail={"success": False, "message": "You cannot remove yourself. Use leave instead."})
            
        member_idx = next((i for i, m in enumerate(household.members) if str(m.user) == str(user_id_to_remove)), -1)
        if member_idx == -1:
            raise HTTPException(status_code=400, detail={"success": False, "message": "User is not a member of this household"})
            
        household.members.pop(member_idx)
        await household.save()
        
        user_to_remove = await User.get(u_id)
        if user_to_remove:
            user_to_remove.household = None
            await user_to_remove.save()
            
        return "Member removed successfully"
