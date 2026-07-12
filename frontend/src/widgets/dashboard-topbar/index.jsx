import { SearchField, TopAppBar } from "@/shared/ui";
export function DashboardTopbar({ title, subtitle, searchPlaceholder, actions, }) {
    return (<TopAppBar title={title} subtitle={subtitle} search={searchPlaceholder ? (<div className="min-w-[280px]">
                        <SearchField placeholder={searchPlaceholder}/>
                    </div>) : undefined} actions={actions}/>);
}
