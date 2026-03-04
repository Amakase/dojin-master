class ChangeColumnDefaultForCollectionWorksNotes < ActiveRecord::Migration[8.1]
  def change
    change_column_default :collection_works, :notes, from: nil, to: ""
  end
end
