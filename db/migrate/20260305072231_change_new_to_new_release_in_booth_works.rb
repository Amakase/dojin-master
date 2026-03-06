class ChangeNewToNewReleaseInBoothWorks < ActiveRecord::Migration[8.1]
  def change
      rename_column :booth_works, :new, :new_release
  end
end
