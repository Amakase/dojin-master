class AddAiPlacementStatusToEvents < ActiveRecord::Migration[8.1]
  def change
    # nil = never triggered | "pending" | "running" | "done" | "failed"
    add_column :events, :ai_placement_status, :string
    add_column :events, :ai_placement_error,  :text
  end
end
